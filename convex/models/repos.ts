import type { Doc, Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { err, ok } from '@convex/shared'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'

export const Repos = {
    async getByIds(ctx: QueryCtx, repoIds: Id<'repos'>[]) {
        let res
        res = repoIds.map((id) => ctx.db.get(id))
        res = await Promise.all(res)
        res = res.filter((r) => r !== null)
        return res
    },

    async getByOwnerAndRepo(ctx: QueryCtx, owner: string, repo: string) {
        return ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (q) => q.eq('owner', owner).eq('repo', repo))
            .unique()
    },

    async deleteById(ctx: MutationCtx, repoId: Id<'repos'>) {
        await ctx.db.delete(repoId)
    },

    async addToOpenIssuesCount(ctx: MutationCtx, repoId: Id<'repos'>, count: number) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            throw new Error(`repo not found: ${repoId}`)
        }

        await ctx.db.patch(repoId, { openIssues: repo.openIssues + count })
    },

    async addToClosedIssuesCount(ctx: MutationCtx, repoId: Id<'repos'>, count: number) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            throw new Error(`repo not found: ${repoId}`)
        }

        await ctx.db.patch(repoId, { closedIssues: repo.closedIssues + count })
    },

    async updateDownloadIfNotCancelled(
        ctx: MutationCtx,
        repoId: Id<'repos'>,
        download: Doc<'repos'>['download'],
    ): R {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            return err('repo not found')
        }

        if (repo.download.status === 'cancelled') {
            return err('download is cancelled')
        }

        await ctx.db.patch(repoId, { download })
        return ok()
    },
}

export const get = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => ctx.db.get(repoId),
})

export const insert = protectedMutation({
    args: schemas.reposSchema,
    handler: (ctx, args) => ctx.db.insert('repos', args),
})

export const getByOwnerAndRepo = protectedQuery({
    args: { owner: v.string(), repo: v.string() },
    handler: (ctx, { owner, repo }) => Repos.getByOwnerAndRepo(ctx, owner, repo),
})

export const deleteById = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Repos.deleteById(ctx, repoId),
})

export function canRepoBeSynced(repo: Doc<'repos'>) {
    return repo.download.status !== 'backfilling' && repo.download.status !== 'syncing'
}

export function doesRepoNeedSyncing(repo: Doc<'repos'>) {
    return repo.download.status === 'cancelled' || repo.download.status === 'error'
}

export const updateDownloadIfNotCancelled = protectedMutation({
    args: {
        repoId: v.id('repos'),
        download: schemas.reposSchema.download,
    },
    handler: (ctx, args) => Repos.updateDownloadIfNotCancelled(ctx, args.repoId, args.download),
})
