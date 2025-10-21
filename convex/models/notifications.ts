import { internalMutation, type MutationCtx } from '@convex/_generated/server'
import schema from '@convex/schema'
import type { FnArgs } from '@convex/utils'
import { v } from 'convex/values'

export namespace Notifications {
    export type UpsertBatchArgs = FnArgs<typeof upsertBatch>
    export const upsertBatch = {
        args: {
            userId: v.id('users'),
            notifs: v.array(
                v.object({
                    repoId: v.id('repos'),
                    type: schema.tables.notifications.validator.fields.type,
                    githubId: v.string(),
                    resourceNumber: v.number(),
                    reason: schema.tables.notifications.validator.fields.reason,
                    updatedAt: v.string(),
                    lastReadAt: v.optional(v.string()),
                    unread: v.boolean(),
                    title: v.string(),
                }),
            ),
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            for (let notif of args.notifs) {
                let existing = await ctx.db
                    .query('notifications')
                    .withIndex('by_github_id', (q) => q.eq('githubId', notif.githubId))
                    .unique()
                if (existing) {
                    await ctx.db.patch(existing._id, {
                        lastReadAt: notif.lastReadAt,
                        unread: notif.unread,
                        updatedAt: notif.updatedAt,
                        title: notif.title,
                        reason: notif.reason,
                    })
                } else {
                    await ctx.db.insert('notifications', {
                        userId: args.userId,
                        repoId: notif.repoId,
                        type: notif.type,
                        githubId: notif.githubId,
                        resourceNumber: notif.resourceNumber,
                        reason: notif.reason,
                        updatedAt: notif.updatedAt,
                        lastReadAt: notif.lastReadAt,
                        unread: notif.unread,
                        title: notif.title,
                    })
                }
            }
        },
    }
}

export const upsertBatch = internalMutation(Notifications.upsertBatch)
