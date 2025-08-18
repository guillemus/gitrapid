import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'

export const Repos = {
    async getByIds(ctx: QueryCtx, repoIds: Id<'repos'>[]) {
        let repos = await Promise.all(repoIds.map((id) => ctx.db.get(id)))

        let filtered = repos.filter((r) => r !== null)

        return filtered
    },

    async getByOwnerAndRepo(ctx: QueryCtx, owner: string, repo: string) {
        return ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (q) => q.eq('owner', owner).eq('repo', repo))
            .unique()
    },

    async get(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db.get(repoId)
    },

    async deleteById(ctx: MutationCtx, repoId: Id<'repos'>) {
        await ctx.db.delete(repoId)
    },
}

export const get = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Repos.get(ctx, repoId),
})

export const getByOwnerAndRepo = protectedQuery({
    args: { owner: v.string(), repo: v.string() },
    handler: (ctx, { owner, repo }) => Repos.getByOwnerAndRepo(ctx, owner, repo),
})

export const deleteById = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Repos.deleteById(ctx, repoId),
})

export const setHead = protectedMutation({
    args: { repoId: v.id('repos'), headRefName: v.string() },
    handler: (ctx, args) => models.setRepoHead(ctx, args.repoId, args.headRefName),
})
