import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import type { UpsertDoc } from './models'

export const Trees = {
    async getByRepoAndSha(ctx: QueryCtx, repoId: Id<'repos'>, sha: string) {
        return ctx.db
            .query('trees')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId).eq('sha', sha))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'trees'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            return existing
        }
        let id = await ctx.db.insert('trees', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let trees = await ctx.db
            .query('trees')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId))
            .collect()
        for (let t of trees) {
            await ctx.db.delete(t._id)
        }
    },
}

export const getByRepoAndSha = protectedQuery({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, { repoId, sha }) => Trees.getByRepoAndSha(ctx, repoId, sha),
})

export const getOrCreate = protectedMutation({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, args) => Trees.getOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Trees.deleteByRepoId(ctx, repoId),
})
