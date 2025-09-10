import type { Id } from '@convex/_generated/dataModel'
import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import * as schemas from '@convex/schema'
import { v } from 'convex/values'

export const UserRepos = {
    async getUserRepoIds(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db
            .query('userRepos')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId))
            .collect()
    },

    async userHasRepo(ctx: QueryCtx, userId: Id<'users'>, repoId: Id<'repos'>) {
        let userRepo = await ctx.db
            .query('userRepos')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId).eq('repoId', repoId))
            .unique()

        return !!userRepo
    },

    async insertIfNotExists(ctx: MutationCtx, userId: Id<'users'>, repoId: Id<'repos'>) {
        let existing = await this.userHasRepo(ctx, userId, repoId)
        if (existing) {
            return existing
        }

        let id = await ctx.db.insert('userRepos', { userId, repoId })
        return await ctx.db.get(id)
    },

    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let userRepos = await ctx.db
            .query('userRepos')
            .filter((q) => q.eq(q.field('repoId'), repoId))
            .collect()

        for (let userRepo of userRepos) {
            await ctx.db.delete(userRepo._id)
        }
    },
}

export const getByUserId = internalQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => UserRepos.getUserRepoIds(ctx, userId),
})

export const insertIfNotExists = internalMutation({
    args: schemas.userReposSchema,
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
