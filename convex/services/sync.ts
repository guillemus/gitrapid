import { internal } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import {
    internalAction,
    internalMutation,
    type ActionCtx,
    type MutationCtx,
} from '@convex/_generated/server'
import { insertIssuesWithCommentsBatch, issueDataForInsert } from '@convex/models/models'
import { Notifications } from '@convex/models/notifications'
import { Repos } from '@convex/models/repos'
import { Users } from '@convex/models/users'
import { newNextSyncAt, v_nextSyncAt, v_nullable } from '@convex/schema'
import { assertOk, err, O, ok } from '@convex/shared'
import { devOnlyMutation, type FnArgs } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { assert } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Octokit } from 'octokit'
import { Github, newOctokit, octoFromUserId } from './github'
import { Graphql } from './graphql'

let self = internal.services.sync

// @ts-expect-error: delete issue syncing crons

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
                    console.warn({ repoId: repo._id }, 'no users found for repo')
                    continue
                }

                await ctx.scheduler.runAfter(0, self.startSyncRepoIssues, {
                    repoId: repo._id,
                    userId: randomUserId,
                })
            }

            if (!repos.isDone) {
                // allow mutation to finish so that it releases function resources.
                // Mutations shall not last more than 1s.
                await ctx.scheduler.runAfter(0, self.cronRepoIssues, {
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
                console.debug({ userId: args.userId, repoId: args.repoId }, 'skipping sync issues')
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
            let hasNewIssues = await step.runAction(self.hasRepoNewIssues, {
                userId: args.userId,
                repoId: args.repoId,
                startSyncAt: args.startSyncAt,
            })
            assertOk(hasNewIssues)

            if (!hasNewIssues.val) {
                console.debug({ userId: args.userId, repoId: args.repoId }, 'no new issues found')
                return
            }

            let cursor: string | undefined
            while (true) {
                let next = await step.runAction(
                    self.downloadRepoPage,
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
            console.debug(`${owner}/${repo}: cursor ${cursor}`)

            let issuesPage = await Graphql.fetchIssuesPage(octo.val, {
                owner,
                repo,
                cursor,
                since: args.lastSyncedAt ?? undefined,
            })
            if (issuesPage.isErr) {
                if (issuesPage.err.type === 'RATE_LIMIT_ERROR') {
                    let secs = Math.max(issuesPage.err.err.retryAfterSecs, 10)
                    console.warn({ secs }, 'rate limited; backing off')
                    await new Promise((resolve) => setTimeout(resolve, secs * 1000))
                    i--
                    continue
                }

                return err(issuesPage.err.err)
            }
            dbInsertsP = dbInsertsP.then(async () => {
                if (issuesPage.val.issues.length > 0) {
                    // await ctx.runMutation(internal.models.models.insertIssuesWithCommentsBatch, {
                    //     repoId: savedRepo._id,
                    //     items: issuesPage.val.issues,
                    // })
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

export const notifications_hasNewNotifs = internalAction({
    args: NotifsArgs,
    async handler(ctx, args) {
        let octo = await getOcto(ctx, args)

        let notifications = await Github.listNotifications(octo, {
            page: args.currPage,
            since: args.since,
            perPage: 1,
        })
        assertOk(notifications)

        return notifications.val.length !== 0
    },
})

export const notifications_download = internalAction({
    args: NotifsArgs,
    async handler(ctx, args): Promise<O<NotifsArgs>> {
        let octo = await getOcto(ctx, args)

        for (let total = args.currPage + 10; args.currPage < total; args.currPage++) {
            if (args.since) {
                console.debug(`downloading notifications page ${args.currPage} since ${args.since}`)
            } else {
                console.debug(`downloading notifications page ${args.currPage}`)
            }

            let notifications = await Github.listNotifications(octo, {
                page: args.currPage,
                since: args.since,
                perPage: 10,
            })
            assertOk(notifications, 'failed to fetch notifications page')

            console.debug('found', notifications.val.length, 'notifications')

            if (notifications.val.length === 0) {
                return O.none()
            }

            let parsedNotifs = parseNotifications(notifications.val)

            let batch = []
            for (let notification of parsedNotifs) {
                let owner = notification.repo.owner
                let repo = notification.repo.repo
                let number = notification.resourceNumber

                if (notification.type === 'Issue') {
                    console.log('fetching', notification.title)

                    let issue = await Graphql.fetchIssue(octo, { owner, repo, number })
                    if (issue.isErr) {
                        let err = Graphql.fetchIssuesErrorsToString(issue.err)
                        throw new Error(err)
                    }

                    batch.push({ issue: issue.val, notification })
                }
            }

            console.debug('inserting', batch.length, 'notifications in batch')

            await ctx.runMutation(self.notifications_upsertBatch, {
                userId: args.userId,
                batch,
            })
        }

        return O.some(args)
    },
})

const notifications_startSyncFn = {
    args: { userId: v.id('users') },
    async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
        let userId = args.userId

        let shouldSync = await Users.shouldSyncNotifs.handler(ctx, { userId })
        if (shouldSync.isErr) {
            console.debug({ userId, error: shouldSync.err }, 'skipping sync notifs')
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
            self.notifications_syncWorkflow,
            {
                currPage: 1,
                nextSyncAt,
                since: startSyncAt,
                userId,
            },
            { startAsync: true },
        )

        await Users.saveNotifWorkflow.handler(ctx, { userId, workflowId, nextSyncAt: null })
    },
}

export const notifications_startSync = internalMutation(notifications_startSyncFn)
export const notifications_startSyncDev = devOnlyMutation(notifications_startSyncFn)

export const notifications_syncWorkflow = workflow.define({
    args: NotifsArgs,
    async handler(step, args) {
        let hasNew = await step.runAction(self.notifications_hasNewNotifs, args)
        if (!hasNew) {
            console.info(`no new notifications found for userId ${args.userId}`)
            return
        }

        success: {
            for (let i = 0; i < 100; i++) {
                console.log('downloading page', i)

                console.log('curr page', args.currPage)
                let newArgs = await step.runAction(self.notifications_download, args)
                if (newArgs.isNone) {
                    break success
                }
                console.log('new currPage', newArgs.val.currPage)

                args = newArgs.val
            }

            throw new Error('max attempts reached')
        }

        await step.runMutation(internal.models.users.saveNotifWorkflow, {
            userId: args.userId,
            workflowId: step.workflowId,
            nextSyncAt: args.nextSyncAt,
        })

        console.log('finished syncing notifications')
    },
})

export const notifications_upsertBatch = internalMutation({
    args: {
        userId: v.id('users'),
        batch: v.array(
            v.object({
                notification: Notifications.vNotification,
                issue: issueDataForInsert,
            }),
        ),
    },
    async handler(ctx, args) {
        for (let notif of args.batch) {
            let repoId = await Notifications.upsertNotification.handler(ctx, {
                userId: args.userId,
                notif: notif.notification,
            })

            await insertIssuesWithCommentsBatch.handler(ctx, {
                repoId,
                item: notif.issue,
            })
        }
    },
})

export const notifications_cron = internalMutation({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let users = await ctx.db.query('users').paginate(args.paginationOpts)
        for (let user of users.page) {
            await ctx.scheduler.runAfter(0, self.notifications_startSync, {
                userId: user._id,
            })
        }

        if (!users.isDone) {
            await ctx.scheduler.runAfter(0, self.notifications_cron, {
                paginationOpts: {
                    ...args.paginationOpts,
                    cursor: users.continueCursor,
                },
            })
        }
    },
})

function parseNotifications(notifs: Github.Notification[]) {
    let mapped: Notifications.UpsertBatchNotif[] = []
    for (let notif of notifs) {
        let resourceUrl = notif.subject.url
        let url = new URL(resourceUrl)
        let resourceNumber = url.pathname.split('/').pop()
        if (!resourceNumber) {
            console.warn(`invalid resource url: ${url.pathname}`)
            continue
        }
        let resourceNumberInt = parseInt(resourceNumber)
        if (Number.isNaN(resourceNumberInt)) {
            console.warn(`invalid resource number: ${resourceNumber}`)
            continue
        }

        let notifType: Doc<'notifications'>['type']
        if (
            notif.subject.type === 'Issue' ||
            notif.subject.type === 'PullRequest' ||
            notif.subject.type === 'Commit' ||
            notif.subject.type === 'Release'
        ) {
            notifType = notif.subject.type
        } else {
            console.warn(`invalid subject type: ${notif.subject.type}`)
            continue
        }

        let reason = Github.notificationReason.safeParse(notif.reason)
        if (!reason.success) {
            console.warn(`invalid reason: ${notif.reason}`)
            continue
        }

        mapped.push({
            type: notifType,
            title: notif.subject.title,
            repo: {
                owner: notif.repository.owner.login,
                repo: notif.repository.name,
                private: notif.repository.private,
            },
            githubId: notif.id,
            resourceNumber: resourceNumberInt,
            reason: reason.data,
            updatedAt: notif.updated_at,
            lastReadAt: notif.last_read_at ?? undefined,
            unread: notif.unread,
        })
    }

    return mapped
}

export const notifications_cancelCurrSyncDev = devOnlyMutation({
    args: { userId: v.id('users') },
    async handler(ctx, args) {
        let userWorkflows = await Users.getWorkflows.handler(ctx, { userId: args.userId })
        assert(userWorkflows, 'user workflows not found')

        if (userWorkflows.syncNotifications?.workflowId) {
            await workflow.cancel(ctx, userWorkflows.syncNotifications.workflowId)
        } else {
            console.debug({ userId: args.userId }, 'no current sync found')
        }
    },
})

export const notifications_resetSinceAndClearNotifs = devOnlyMutation({
    args: { userId: v.id('users') },
    async handler(ctx, args) {
        let userWorkflows = await Users.getWorkflows.handler(ctx, { userId: args.userId })
        assert(userWorkflows, 'user workflows not found')

        await ctx.db.patch(userWorkflows._id, {
            syncNotifications: {
                workflowId: userWorkflows.syncNotifications.workflowId,
                nextSyncAt: undefined,
            },
        })

        let notifs = await ctx.db
            .query('notifications')
            .withIndex('by_userId_updatedAt', (q) => q.eq('userId', args.userId))
            .collect()

        for (let notif of notifs) {
            await ctx.db.delete(notif._id)
        }
    },
})
