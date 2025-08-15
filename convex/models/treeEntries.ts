import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'
import type { UpsertDoc } from './models'

export const TreeEntries = {
    async getByRepoAndTreeAndEntry(
        ctx: QueryCtx,
        repoId: Id<'repos'>,
        rootTreeSha: string,
        path: string,
    ) {
        return ctx.db
            .query('treeEntries')
            .withIndex('by_repo_tree_and_path', (q) =>
                q.eq('repoId', repoId).eq('rootTreeSha', rootTreeSha).eq('path', path),
            )
            .unique()
    },

    async getByRepoAndTree(ctx: QueryCtx, repoId: Id<'repos'>, rootTreeSha: string) {
        return ctx.db
            .query('treeEntries')
            .withIndex('by_repo_tree_and_path', (q) =>
                q.eq('repoId', repoId).eq('rootTreeSha', rootTreeSha),
            )
            .collect()
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'treeEntries'>) {
        let existing = await this.getByRepoAndTreeAndEntry(
            ctx,
            args.repoId,
            args.rootTreeSha,
            args.path,
        )
        if (existing) {
            return existing
        }
        let id = await ctx.db.insert('treeEntries', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let entries = await ctx.db
            .query('treeEntries')
            .withIndex('by_repo_tree_and_path', (q) => q.eq('repoId', repoId))
            .collect()
        for (let e of entries) {
            await ctx.db.delete(e._id)
        }
    },
}

export const getByRepoAndTreeAndEntry = protectedQuery({
    args: { repoId: v.id('repos'), rootTreeSha: v.string(), path: v.string() },
    handler: (ctx, { repoId, rootTreeSha, path }) =>
        TreeEntries.getByRepoAndTreeAndEntry(ctx, repoId, rootTreeSha, path),
})

export const getByRepoAndTree = protectedQuery({
    args: { repoId: v.id('repos'), rootTreeSha: v.string() },
    handler: (ctx, { repoId, rootTreeSha }) =>
        TreeEntries.getByRepoAndTree(ctx, repoId, rootTreeSha),
})

export const getOrCreate = protectedMutation({
    args: schemas.treeEntriesSchema,
    handler: (ctx, args) => TreeEntries.getOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => TreeEntries.deleteByRepoId(ctx, repoId),
})
