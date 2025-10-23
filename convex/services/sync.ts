import { internal } from '@convex/_generated/api'
import {
    internalAction,
    internalMutation,
    type ActionCtx,
    type MutationCtx,
} from '@convex/_generated/server'
import { Repos } from '@convex/models/repos'
import { Users } from '@convex/models/users'
import { newNextSyncAt, v_nextSyncAt, v_nullable } from '@convex/schema'
import { assertOk, err, O, ok } from '@convex/shared'
import { devOnlyMutation, logger, type FnArgs } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { assert } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Octokit } from 'octokit'
import { Github, newOctokit, octoFromUserId } from './github'
import { Graphql } from './graphql'

let fns = internal.services.sync

export namespace Crons {
    export const repoIssues = {
        args: {
            paginationOpts: paginationOptsValidator,
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let repos = await ctx.db.query('repos').paginate(args.paginationOpts)

            for (let repo of repos.page) {
                let shouldSync = await Repos.shouldSyncIssues.handler(ctx, { repoId: repo._id })
                if (shouldSync.isErr) continue

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
    }
}
export const cronRepoIssues = internalMutation(Crons.repoIssues)

export namespace Issues {
    export const startSyncRepoIssues = {
        args: {
            userId: v.id('users'),
            repoId: v.id('repos'),
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let shouldSync = await Repos.shouldSyncIssues.handler(ctx, { repoId: args.repoId })
            if (shouldSync.isErr) {
                logger.debug({ userId: args.userId, repoId: args.repoId }, 'skipping sync issues')
                return
            }

            let repoWorkflow = await Repos.getWorkflow.handler(ctx, { repoId: args.repoId })

            let startSyncAt = repoWorkflow?.issues.nextSyncAt ?? null
            let nextSyncAt = newNextSyncAt(new Date())

            let workflowId = await workflow.start(
                ctx,
                internal.services.sync.syncIssues,
                { userId: args.userId, repoId: args.repoId, startSyncAt, nextSyncAt },
                { startAsync: true },
            )

            await Repos.saveIssuesWorkflow.handler(ctx, {
                repoId: args.repoId,
                workflow: {
                    workflowId,
                    nextSyncAt: null,
                },
            })
        },
    }

    export const syncRepoIssues = workflow.define({
        args: {
            userId: v.id('users'),
            repoId: v.id('repos'),
            startSyncAt: v_nullable(v_nextSyncAt),
            nextSyncAt: v_nextSyncAt,
        },
        async handler(step, args): Promise<void> {
            let hasNewIssues = await step.runAction(fns.hasRepoNewIssues, {
                userId: args.userId,
                repoId: args.repoId,
                startSyncAt: args.startSyncAt,
            })
            assertOk(hasNewIssues)

            if (!hasNewIssues.val) {
                logger.debug({ userId: args.userId, repoId: args.repoId }, 'no new issues found')
                return
            }

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

            await step.runMutation(internal.models.repos.saveIssuesWorkflow, {
                repoId: args.repoId,
                workflow: { workflowId: step.workflowId, nextSyncAt: args.nextSyncAt },
            })
        },
    })
}

export const startSyncRepoIssues = internalMutation(Issues.startSyncRepoIssues)
export const startSyncRepoIssuesDev = devOnlyMutation(Issues.startSyncRepoIssues)
export const syncIssues = Issues.syncRepoIssues

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

export const hasRepoNewIssues = internalAction({
    args: { userId: v.id('users'), repoId: v.id('repos'), startSyncAt: v_nullable(v_nextSyncAt) },
    async handler(ctx, args) {
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

const NotifsArgs = {
    userId: v.id('users'),
    currPage: v.number(),
    nextSyncAt: v_nullable(v_nextSyncAt),
    since: v.optional(v.string()),
}
type NotifsArgs = FnArgs<{ args: typeof NotifsArgs }>

async function getOcto(ctx: ActionCtx, args: NotifsArgs): Promise<Octokit> {
    let res = await ctx.runQuery(internal.models.users.get, { userId: args.userId })
    let token = res?.accessToken
    assert(token, 'user access token not found')

    return newOctokit({ token })
}

export const notifications_checkIfNew = internalAction({
    args: NotifsArgs,
    async handler(ctx, args) {
        let octo = await getOcto(ctx, args)

        let notifications = await Github.listNotifications(octo, {
            page: args.currPage,
            since: args.since,
        })
        assertOk(notifications)

        return notifications.val.length === 0
    },
})

export const notifications_download = internalAction({
    args: NotifsArgs,
    async handler(ctx, args): Promise<O<NotifsArgs>> {
        let octo = await getOcto(ctx, args)

        for (let i = args.currPage; i < 10; i++) {
            let notifications = await Github.listNotifications(octo, {
                page: i,
                since: args.since,
            })
            assertOk(notifications)

            if (notifications.val.length === 0) {
                return O.none()
            }

            await ctx.runMutation(internal.models.notifications.upsertBatch, {
                userId: args.userId,
                notifs: notifications.val,
            })

            args.currPage++
        }

        return O.some(args)
    },
})

export const notifications_startSync = internalMutation({
    args: { userId: v.id('users') },
    async handler(ctx, args) {
        let userId = args.userId

        let shouldSync = await Users.shouldSyncNotifs.handler(ctx, { userId })
        if (shouldSync.isErr) {
            logger.debug({ userId, error: shouldSync.err }, 'skipping sync notifs')
            return
        }

        let userWorkflows = await Users.getWorkflows.handler(ctx, { userId })

        // startSyncAt is the moment from where we start syncing. If undefined,
        // we do a backfill of notifications
        let startSyncAt = userWorkflows?.syncNotifications?.nextSyncAt

        // nextSyncAt is the moment from where we will start the next sync.
        let nextSyncAt = newNextSyncAt(new Date())

        let workflowId = await workflow.start(
            ctx,
            fns.notifications_syncWorkflow,
            {
                currPage: 0,
                nextSyncAt,
                since: startSyncAt ?? undefined,
                userId,
            },
            { startAsync: true },
        )

        await Users.saveNotifWorkflow.handler(ctx, { userId, workflowId, nextSyncAt: null })
    },
})

export const notifications_syncWorkflow = workflow.define({
    args: NotifsArgs,
    async handler(step, args) {
        let hasNew = await step.runAction(fns.notifications_checkIfNew, args)
        if (!hasNew) {
            console.info(`no new notifications found for userId ${args.userId}`)
            return
        }

        while (true) {
            let newArgs = await step.runAction(fns.notifications_download, args)
            if (newArgs.isNone) {
                break
            }

            args = newArgs.val
        }

        await step.runMutation(internal.models.users.saveNotifWorkflow, {
            userId: args.userId,
            workflowId: step.workflowId,
            nextSyncAt: args.nextSyncAt,
        })
    },
})

export const notifications_cron = internalMutation({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let users = await ctx.db.query('users').paginate(args.paginationOpts)
        for (let user of users.page) {
            await ctx.scheduler.runAfter(0, fns.notifications_startSync, {
                userId: user._id,
            })
        }

        if (!users.isDone) {
            await ctx.scheduler.runAfter(0, fns.notifications_cron, {
                paginationOpts: {
                    ...args.paginationOpts,
                    cursor: users.continueCursor,
                },
            })
        }
    },
})
