import type { Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'
import type { UpsertDoc } from './models'

export const RepoDownloads = {
    async getByRepoId(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('repoDownloads')
            .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
            .unique()
    },

    async getOrCreate(ctx: MutationCtx, repoId: Id<'repos'>) {
        let existing = await this.getByRepoId(ctx, repoId)
        if (existing) return existing

        let id = await ctx.db.insert('repoDownloads', {
            repoId,
            status: 'initial',
        })
        return await ctx.db.get(id)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'repoDownloads'>) {
        let existing = await this.getByRepoId(ctx, args.repoId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        let id = await ctx.db.insert('repoDownloads', args)
        return await ctx.db.get(id)
    },

    async updateSince(ctx: MutationCtx, repoId: Id<'repos'>, syncedSince: string) {
        let existing = await this.getByRepoId(ctx, repoId)
        if (!existing) return null

        await ctx.db.patch(existing._id, { syncedSince })
        return await ctx.db.get(existing._id)
    },

    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let existing = await this.getByRepoId(ctx, repoId)
        if (existing) {
            await ctx.db.delete(existing._id)
        }
    },
}

export const getByRepoId = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => RepoDownloads.getByRepoId(ctx, repoId),
})

export const getOrCreate = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => RepoDownloads.getOrCreate(ctx, repoId),
})

export const upsert = protectedMutation({
    args: schemas.repoDownloadsSchema,
    handler: (ctx, args) => RepoDownloads.upsert(ctx, args),
})

export const updateSince = protectedMutation({
    args: {
        repoId: v.id('repos'),
        syncedSince: v.string(),
    },
    handler: (ctx, args) => RepoDownloads.updateSince(ctx, args.repoId, args.syncedSince),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => RepoDownloads.deleteByRepoId(ctx, repoId),
})
