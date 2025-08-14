import type { Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import * as schemas from '@convex/schema'
import { protectedMutation, protectedQuery } from '@convex/utils'
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

    async insertUserRepo(ctx: MutationCtx, userId: Id<'users'>, repoId: Id<'repos'>) {
        return ctx.db.insert('userRepos', { userId, repoId })
    },
}

export const getByUserId = protectedQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => UserRepos.getUserRepoIds(ctx, userId),
})

export const insertUserRepo = protectedMutation({
    args: schemas.userReposSchema,
    handler: (ctx, { userId, repoId }) => UserRepos.insertUserRepo(ctx, userId, repoId),
})
