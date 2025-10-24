import { type MutationCtx } from '@convex/_generated/server'
import schema from '@convex/schema'
import type { FnArgs } from '@convex/utils'
import { v, type Infer } from 'convex/values'
import { Repos } from './repos'

export namespace Notifications {
    export type UpsertBatchNotif = Infer<typeof vNotification>

    export const vNotification = v.object({
        repo: v.object({
            owner: v.string(),
            repo: v.string(),
            private: v.boolean(),
        }),
        type: schema.tables.notifications.validator.fields.type,
        githubId: v.string(),
        resourceNumber: v.number(),
        reason: schema.tables.notifications.validator.fields.reason,
        updatedAt: v.string(),
        lastReadAt: v.optional(v.string()),
        unread: v.boolean(),
        title: v.string(),
    })

    export const upsertNotification = {
        args: {
            userId: v.id('users'),
            notif: vNotification,
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let repoId = await Repos.upsertRepoForUser.handler(ctx, {
                userId: args.userId,
                owner: args.notif.repo.owner,
                repo: args.notif.repo.repo,
                private: args.notif.repo.private,
            })

            let existing = await ctx.db
                .query('notifications')
                .withIndex('by_github_id', (q) => q.eq('githubId', args.notif.githubId))
                .unique()
            if (existing) {
                await ctx.db.patch(existing._id, {
                    lastReadAt: args.notif.lastReadAt,
                    unread: args.notif.unread,
                    updatedAt: args.notif.updatedAt,
                    title: args.notif.title,
                    reason: args.notif.reason,
                })
            } else {
                await ctx.db.insert('notifications', {
                    userId: args.userId,
                    repoId: repoId,
                    type: args.notif.type,
                    githubId: args.notif.githubId,
                    resourceNumber: args.notif.resourceNumber,
                    reason: args.notif.reason,
                    updatedAt: args.notif.updatedAt,
                    lastReadAt: args.notif.lastReadAt,
                    unread: args.notif.unread,
                    title: args.notif.title,
                })
            }

            return repoId
        },
    }
}
