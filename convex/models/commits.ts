import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import * as schemas from '@convex/schema'
import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import type { UpsertDoc } from './models'

export const Commits = {
    async getByRepoAndSha(ctx: QueryCtx, repoId: Id<'repos'>, sha: string) {
        return ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId).eq('sha', sha))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'commits'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            return existing
        }
        let id = await ctx.db.insert('commits', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let commits = await ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId))
            .collect()
        for (let c of commits) {
            await ctx.db.delete(c._id)
        }
    },
}

export const getByRepoAndSha = protectedQuery({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, { repoId, sha }) => Commits.getByRepoAndSha(ctx, repoId, sha),
})

export const getOrCreate = protectedMutation({
    args: schemas.commitsSchema,
    handler: (ctx, args) => Commits.getOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Commits.deleteByRepoId(ctx, repoId),
})
