import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'
import type { UpsertDoc } from './models'

export const RepoDownloadStatus = {
    async getByRepoId(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('repoDownloadStatus')
            .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
            .unique()
    },

    async getOrCreate(ctx: MutationCtx, repoId: Id<'repos'>) {
        let existing = await this.getByRepoId(ctx, repoId)
        if (existing) return existing

        let id = await ctx.db.insert('repoDownloadStatus', { repoId, status: 'initial' })
        return await ctx.db.get(id)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'repoDownloadStatus'>) {
        let existing = await this.getByRepoId(ctx, args.repoId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        let id = await ctx.db.insert('repoDownloadStatus', args)
        return await ctx.db.get(id)
    },
}

export const getByRepoId = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => RepoDownloadStatus.getByRepoId(ctx, repoId),
})

export const getOrCreate = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => RepoDownloadStatus.getOrCreate(ctx, repoId),
})

export const upsert = protectedMutation({
    args: schemas.repoDownloadStatusSchema,
    handler: (ctx, args) => RepoDownloadStatus.upsert(ctx, args),
})
