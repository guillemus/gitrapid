import type { Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import type { FnArgs } from '@convex/utils'
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

    export const insertIfNotExists = {
        args: {
            userId: v.id('users'),
            repoId: v.id('repos'),
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let existing = await userHasRepo(ctx, args.userId, args.repoId)
            if (existing) {
                return existing
            }

            let id = await ctx.db.insert('userRepos', { userId: args.userId, repoId: args.repoId })
            return await ctx.db.get(id)
        },
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
