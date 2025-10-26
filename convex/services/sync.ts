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
import { Users } from '@convex/models/users'
import { newNextSyncAt, v_nextSyncAt, v_nullable } from '@convex/schema'
import { assertNever, assertOk, O } from '@convex/shared'
import { devOnlyMutation, type FnArgs } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { assert } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Octokit } from 'octokit'
import { Github, newOctokit } from './github'
import { Graphql } from './graphql'

let self = internal.services.sync

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
                    let issue = await Graphql.fetchIssue(octo, { owner, repo, number })
                    if (issue.isErr) {
                        let err = Graphql.fetchIssuesErrorsToString(issue.err)
                        throw new Error(err)
                    }

                    batch.push({ issue: issue.val, notification })
                } else if (notification.type === 'PullRequest') {
                } else if (notification.type === 'Commit') {
                } else if (notification.type === 'Release') {
                } else assertNever(notification.type)
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
    let mapped: Notifications.Notification[] = []
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

        await workflow.cancel(ctx, userWorkflows.syncNotifications.workflowId)
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
