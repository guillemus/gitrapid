import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import * as schemas from '@convex/schema'
import { protectedMutation, protectedQuery } from '@convex/utils'
import { v } from 'convex/values'
import type { UpsertDoc } from './models'

export const Blobs = {
    async getByRepoAndSha(ctx: QueryCtx, repoId: Id<'repos'>, sha: string) {
        return ctx.db
            .query('blobs')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId).eq('sha', sha))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'blobs'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            return existing
        }
        return await ctx.db.insert('blobs', args)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'blobs'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }
        let id = await ctx.db.insert('blobs', args)
        return await ctx.db.get(id)
    },
}

export const getByRepoAndSha = protectedQuery({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, { repoId, sha }) => Blobs.getByRepoAndSha(ctx, repoId, sha),
})

export const getOrCreate = protectedMutation({
    args: schemas.blobsSchema,
    handler: (ctx, args) => Blobs.getOrCreate(ctx, args),
})

export const upsert = protectedMutation({
    args: schemas.blobsSchema,
    handler: (ctx, args) => Blobs.upsert(ctx, args),
})
