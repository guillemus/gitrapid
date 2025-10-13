import type { Id } from '@convex/_generated/dataModel'
import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import schema from '@convex/schema'
import { v } from 'convex/values'

export namespace UserRepos {
    export async function getUserRepoIds(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db
            .query('userRepos')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId))
            .collect()
    }

    export async function userHasRepo(ctx: QueryCtx, userId: Id<'users'>, repoId: Id<'repos'>) {
        let userRepo = await ctx.db
            .query('userRepos')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId).eq('repoId', repoId))
            .unique()

        return !!userRepo
    }

    export async function insertIfNotExists(
        ctx: MutationCtx,
        userId: Id<'users'>,
        repoId: Id<'repos'>,
    ) {
        let existing = await userHasRepo(ctx, userId, repoId)
        if (existing) {
            return existing
        }

        let id = await ctx.db.insert('userRepos', { userId, repoId })
        return await ctx.db.get(id)
    }

    export async function deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let userRepos = await ctx.db
            .query('userRepos')
            .filter((q) => q.eq(q.field('repoId'), repoId))
            .collect()

        for (let userRepo of userRepos) {
            await ctx.db.delete(userRepo._id)
        }
    }
}

export const getByUserId = internalQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => UserRepos.getUserRepoIds(ctx, userId),
})

export const insertIfNotExists = internalMutation({
    args: schema.tables.userRepos.validator.fields,
    handler: (ctx, { userId, repoId }) => UserRepos.insertIfNotExists(ctx, userId, repoId),
})

export const deleteByRepoId = internalMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => UserRepos.deleteByRepoId(ctx, repoId),
})

export const listByUserId = internalQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => UserRepos.getUserRepoIds(ctx, userId),
})
