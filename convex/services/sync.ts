import { vWorkflowId } from '@convex-dev/workflow'
import { vResultValidator } from '@convex-dev/workpool'
import { internal } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { internalAction, internalMutation } from '@convex/_generated/server'
import type { Notifications } from '@convex/models/notifications'
import { Repos } from '@convex/models/repos'
import { Users } from '@convex/models/users'
import { newNextSyncAt, v_nextSyncAt, v_nullable } from '@convex/schema'
import { assertOk, err, ok, unwrap } from '@convex/shared'
import { logger, type WCtx } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { assert } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { Github, newOctokit, octoFromUserId } from './github'
import { Graphql } from './graphql'

let fns = internal.services.sync

// Listing data reference:
// https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-commits
// https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#list-matching-references
// https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28&search-overlay-input=heads#list-repository-issues

export const cronRepoIssues = internalMutation({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let repos = await ctx.db.query('repos').paginate(args.paginationOpts)

        for (let repo of repos.page) {
            let shouldSync = await Repos.shouldSyncIssues.handler(ctx, { repoId: repo._id })
            if (!shouldSync) continue

            let userRepos = await ctx.db
                .query('userRepos')
                .withIndex('by_repoId', (r) => r.eq('repoId', repo._id))
                .collect()
            let userIds = userRepos.map((r) => r.userId)

            // for a moreless fair distribution of token usage
            let randomUserId = userIds[Math.floor(Math.random() * userIds.length)]
            if (!randomUserId) {
                logger.warn({ repoId: repo._id }, 'no users found for repo')
                continue
            }

            await ctx.scheduler.runAfter(0, fns.startSyncRepoIssues, {
                repoId: repo._id,
                userId: randomUserId,
            })
        }

        if (!repos.isDone) {
            // allow mutation to finish so that it releases function resources.
            // Mutations shall not last more than 1s.
            await ctx.scheduler.runAfter(0, fns.cronRepoIssues, {
                paginationOpts: {
                    ...args.paginationOpts,
                    cursor: repos.continueCursor,
                },
            })
        }
    },
})

export const cronUserNotifications = internalMutation({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let users = await ctx.db.query('users').paginate(args.paginationOpts)
        for (let user of users.page) {
            await ctx.scheduler.runAfter(0, fns.startSyncNotifsMutation, {
                userId: user._id,
            })
        }

        if (!users.isDone) {
            await ctx.scheduler.runAfter(0, fns.cronUserNotifications, {
                paginationOpts: {
                    ...args.paginationOpts,
                    cursor: users.continueCursor,
                },
            })
        }
    },
})

const TOTAL_FETCHES_PER_CALL = 10

export const downloadRepoPage = internalAction({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        cursor: v.optional(v.string()),
        lastSyncedAt: v_nullable(v.string()),
    },
    async handler(ctx, args): R<{ nextCursor?: string }> {
        let octo = await octoFromUserId(ctx, args.userId)
        if (octo.isErr) return octo

        let savedRepo = await ctx.runQuery(internal.models.repos.get, { repoId: args.repoId })
        if (!savedRepo) return err('repo not found')

        let { owner, repo } = savedRepo
        let cursor = args.cursor

        let dbInsertsP = Promise.resolve()
        for (let i = 0; i < TOTAL_FETCHES_PER_CALL; i++) {
            logger.debug(`${owner}/${repo}: cursor ${cursor}`)

            let issuesPage = await Graphql.fetchIssuesPage(octo.val, {
                owner,
                repo,
                cursor,
                since: args.lastSyncedAt ?? undefined,
            })
            if (issuesPage.isErr) {
                if (issuesPage.err.type === 'RATE_LIMIT_ERROR') {
                    let secs = Math.max(issuesPage.err.err.retryAfterSecs, 10)
                    logger.warn({ secs }, 'rate limited; backing off')
                    await new Promise((resolve) => setTimeout(resolve, secs * 1000))
                    i--
                    continue
                }

                return err(issuesPage.err.err)
            }

            dbInsertsP = dbInsertsP.then(async () => {
                if (issuesPage.val.issues.length > 0) {
                    await ctx.runMutation(internal.models.models.insertIssuesWithCommentsBatch, {
                        repoId: savedRepo._id,
                        items: issuesPage.val.issues,
                    })
                }
            })

            let nextCursor = Graphql.getNextCursor(issuesPage.val.pageInfo)
            if (nextCursor.isNone) {
                cursor = undefined
                break
            }
            cursor = nextCursor.val.cursor

            // tiny jitter to avoid bursts
            let jitter = Math.floor(Math.random() * 200 + 1000)
            await new Promise((resolve) => setTimeout(resolve, jitter))
        }

        await dbInsertsP

        return ok({ nextCursor: cursor })
    },
})

const NOTIFS_BATCH_SIZE = 100

export const startSyncNotifsMutation = internalMutation({
    args: { userId: v.id('users') },
    async handler(ctx, { userId }) {
        let shouldSync = await Users.shouldSyncNotifs.handler(ctx, { userId })
        if (!shouldSync) return

        let userWorkflows = await Users.getWorkflows.handler(ctx, { userId })

        // startSyncAt is the moment from where we start syncing. If undefined,
        // we do a backfill of notifications
        let startSyncAt = userWorkflows?.syncNotifications?.nextSyncAt

        // nextSyncAt is the moment from where we will start the next sync.
        let nextSyncAt = newNextSyncAt(new Date())

        let workflowId = await workflow.start(
            ctx,
            internal.services.sync.syncNotifs,
            { userId, startSyncAt },
            {
                startAsync: true,
                onComplete: fns.handleSyncNotifsComplete,
                context: { userId, nextSyncAt } satisfies WCtx<typeof fns.handleSyncNotifsComplete>,
            },
        )

        await Users.saveNotifWorkflow.handler(ctx, {
            userId,
            workflowId,
            nextSyncAt: null,
        })
    },
})

export const handleSyncNotifsComplete = internalMutation({
    args: {
        workflowId: vWorkflowId,
        context: v.object({
            userId: v.id('users'),
            nextSyncAt: v_nullable(v_nextSyncAt),
        }),
        result: vResultValidator,
    },
    async handler(ctx, args) {
        if (args.result.kind === 'success') {
            await Users.saveNotifWorkflow.handler(ctx, {
                userId: args.context.userId,
                workflowId: args.workflowId,
                nextSyncAt: args.context.nextSyncAt,
            })
        }
    },
})

export const syncNotifs = workflow.define({
    args: { userId: v.id('users'), startSyncAt: v.optional(v.string()) },
    async handler(step, args) {
        let result = await step.runAction(internal.services.sync.downloadNotifications, {
            userId: args.userId,
            since: args.startSyncAt,
        })
        if (result.isErr) {
            if (result.err.type === 'not-modified') {
                return
            }

            // notify workflow that this failed for some reason
            unwrap(result)
            return
        }
    },
})

export const downloadNotifications = internalAction({
    args: {
        userId: v.id('users'),
        since: v.optional(v.string()),
    },
    async handler(ctx, args) {
        let pat = await ctx.runQuery(internal.models.pats.getByUserId, { userId: args.userId })
        assert(pat, 'user token not found')

        let octo = newOctokit(pat)

        let notifs = await Github.listAllNotifications(octo, {
            since: args.since,
        })
        if (notifs.isErr) {
            return notifs
        }

        let upsertedRepos = new Map<number, Id<'repos'>>()
        for (let i = 0; i < notifs.val.length; i += NOTIFS_BATCH_SIZE) {
            let batch = notifs.val.slice(i, i + NOTIFS_BATCH_SIZE)
            let toUpsert: Notifications.UpsertBatchArgs['notifs'] = []
            for (let notif of batch) {
                let repoId = upsertedRepos.get(notif.repo.id)
                if (!repoId) {
                    repoId = await ctx.runMutation(internal.models.repos.upsertRepoForUser, {
                        userId: args.userId,
                        owner: notif.repo.owner,
                        repo: notif.repo.name,
                        private: notif.repo.private,
                    })
                    upsertedRepos.set(notif.repo.id, repoId)
                }

                toUpsert.push({
                    repoId: repoId,
                    type: notif.type,
                    githubId: notif.githubId,
                    title: notif.title,
                    updatedAt: notif.updatedAt,
                    reason: notif.reason,
                    resourceNumber: notif.resourceNumber,
                    unread: notif.unread,
                    lastReadAt: notif.lastReadAt ?? undefined,
                })
            }

            await ctx.runMutation(internal.models.notifications.upsertBatch, {
                userId: args.userId,
                notifs: toUpsert,
            })
        }

        return ok()
    },
})

export const startSyncRepoIssues = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let shouldSync = await Repos.shouldSyncIssues.handler(ctx, { repoId: args.repoId })
        if (!shouldSync) {
            logger.warn({ userId: args.userId, repoId: args.repoId }, 'repo issues already synced')
            return
        }

        let repoWorkflow = await Repos.getWorkflow.handler(ctx, { repoId: args.repoId })

        let startSyncAt = repoWorkflow?.issues.nextSyncAt ?? null
        let nextSyncAt = newNextSyncAt(new Date())

        let workflowId = await workflow.start(
            ctx,
            internal.services.sync.syncIssues,
            { userId: args.userId, repoId: args.repoId, startSyncAt },
            {
                startAsync: true,
                context: {
                    repoId: args.repoId,
                    nextSyncAt,
                } satisfies WCtx<typeof fns.handleSyncIssuesComplete>,
                onComplete: fns.handleSyncIssuesComplete,
            },
        )

        await Repos.saveIssuesWorkflow.handler(ctx, {
            repoId: args.repoId,
            workflow: {
                workflowId,
                nextSyncAt,
            },
        })
    },
})

export const handleSyncIssuesComplete = internalMutation({
    args: {
        workflowId: vWorkflowId,
        context: v.object({
            repoId: v.id('repos'),
            nextSyncAt: v_nextSyncAt,
        }),
        result: vResultValidator,
    },
    async handler(ctx, args) {
        if (args.result.kind === 'success') {
            await Repos.saveIssuesWorkflow.handler(ctx, {
                repoId: args.context.repoId,
                workflow: {
                    workflowId: args.workflowId,
                    nextSyncAt: args.context.nextSyncAt,
                },
            })
        }
    },
})

export const syncIssues = workflow.define({
    args: { userId: v.id('users'), repoId: v.id('repos'), startSyncAt: v_nullable(v_nextSyncAt) },
    async handler(step, args): Promise<void> {
        let hasNewIssues = await step.runAction(fns.hasRepoNewIssues, {
            userId: args.userId,
            repoId: args.repoId,
            startSyncAt: args.startSyncAt,
        })
        if (hasNewIssues.isErr) return

        let cursor: string | undefined
        while (true) {
            let next = await step.runAction(
                fns.downloadRepoPage,
                {
                    userId: args.userId,
                    repoId: args.repoId,
                    lastSyncedAt: args.startSyncAt,
                    cursor,
                },
                { retry: { initialBackoffMs: 4000, base: 2, maxAttempts: 5 } },
            )
            assertOk(next)

            if (!next.val.nextCursor) break
            cursor = next.val.nextCursor
        }
    },
})

export const hasRepoNewIssues = internalAction({
    args: { userId: v.id('users'), repoId: v.id('repos'), startSyncAt: v_nullable(v_nextSyncAt) },
    async handler(ctx, args): R<boolean> {
        let octo = await octoFromUserId(ctx, args.userId)
        if (octo.isErr) return octo

        let savedRepo = await ctx.runQuery(internal.models.repos.get, { repoId: args.repoId })
        if (!savedRepo) return err('repo not found')

        let repoWorkflow = await ctx.runQuery(internal.models.repos.getWorkflow, {
            repoId: args.repoId,
        })
        assert(repoWorkflow, 'repo workflow must already exist')

        let etag = repoWorkflow.issues.etag

        let issueUpdates = await Github.checkForIssueUpdates(octo.val, {
            owner: savedRepo.owner,
            repo: savedRepo.repo,
            since: args.startSyncAt ?? undefined,
            etag,
        })
        if (issueUpdates.isErr) return issueUpdates

        let newEtag = issueUpdates.val.newEtag
        if (newEtag) {
            await ctx.runMutation(internal.models.repos.setIssuesWorkflowEtag, {
                repoId: args.repoId,
                etag: newEtag,
            })
        }

        return ok(issueUpdates.val.hasUpdates)
    },
})
