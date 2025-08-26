import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import { IssueComments } from './issueComments'

export const Issues = {
    async getByRepoAndNumber(ctx: QueryCtx, args: { repoId: Id<'repos'>; number: number }) {
        return ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) =>
                q.eq('repoId', args.repoId).eq('number', args.number),
            )
            .unique()
    },

    async listByRepo(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) => q.eq('repoId', repoId))
            .collect()
    },

    async paginateByRepo(
        ctx: QueryCtx,
        args: { repoId: Id<'repos'>; paginationOpts: { numItems: number; cursor: string | null } },
    ) {
        return ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) => q.eq('repoId', args.repoId))
            .order('desc')
            .paginate(args.paginationOpts)
    },

    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let issues = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) => q.eq('repoId', repoId))
            .collect()

        for (let issue of issues) {
            await IssueComments.deleteByIssueId(ctx, issue._id)
            await ctx.db.delete(issue._id)
        }
    },
}

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Issues.deleteByRepoId(ctx, repoId),
})

export const getByRepoAndNumber = protectedQuery({
    args: { repoId: v.id('repos'), number: v.number() },
    handler: (ctx, { repoId, number }) => Issues.getByRepoAndNumber(ctx, { repoId, number }),
})

export const listByRepo = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Issues.listByRepo(ctx, repoId),
})
