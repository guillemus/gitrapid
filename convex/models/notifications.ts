import type { Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import schema from '@convex/schema'
import { asyncMap } from 'convex-helpers'
import { v, type Infer } from 'convex/values'
import { Repos } from './repos'

export namespace Notifications {
    export type Notification = Infer<typeof vNotification>

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

    export async function upsertNotification(
        ctx: MutationCtx,
        userId: Id<'users'>,
        notif: Notification,
    ) {
        let repoId = await Repos.upsertRepoForUser.handler(ctx, {
            userId,
            owner: notif.repo.owner,
            repo: notif.repo.repo,
            private: notif.repo.private,
        })

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
                userId,
                unread: notif.unread,
                pinned: false,
                done: false,
                saved: false,
                repoId: repoId,
                type: notif.type,
                githubId: notif.githubId,
                resourceNumber: notif.resourceNumber,
                reason: notif.reason,
                updatedAt: notif.updatedAt,
                lastReadAt: notif.lastReadAt,
                title: notif.title,
            })
        }

        return repoId
    }

    export async function distinctRepos(ctx: QueryCtx, userId: Id<'users'>) {
        const foundRepos = new Set<Id<'repos'>>()
        let doc = await ctx.db
            .query('notifications')
            .withIndex('by_userId_repoId_updatedAt', (q) => q.eq('userId', userId))
            .order('desc')
            .first()
        while (doc !== null) {
            let repoId = doc.repoId
            foundRepos.add(repoId)
            doc = await ctx.db
                .query('notifications')
                .withIndex('by_userId_repoId_updatedAt', (q) =>
                    q.eq('userId', userId).lt('repoId', repoId),
                )
                .order('desc')
                .first()
        }

        let repos
        repos = await asyncMap(foundRepos.values(), (r) => ctx.db.get(r))
        repos = repos.filter((r) => r !== null)

        return repos
    }
}
