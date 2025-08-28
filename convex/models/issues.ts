import type { Id } from '@convex/_generated/dataModel'
import type { QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import { protectedQuery } from '../utils'

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

    async paginate(
        ctx: QueryCtx,
        args: {
            repoId: Id<'repos'>
            state?: 'open' | 'closed'
            search?: string
            paginationOpts: {
                numItems: number
                cursor: string | null
            }
        },
    ) {
        // If search is provided, use search index with optional state filter
        if (args.search && args.search.trim().length > 0) {
            let q = ctx.db.query('issues').withSearchIndex('search_issues', (s) => {
                let scoped = s.search('title', args.search as string).eq('repoId', args.repoId)
                if (args.state) {
                    return scoped.eq('state', args.state)
                }
                return scoped
            })

            return q.paginate(args.paginationOpts)
        }

        // No search term; use compound index by repo, state, number if state provided
        if (args.state) {
            return ctx.db
                .query('issues')
                .withIndex('by_repo_state_number', (q) =>
                    q.eq('repoId', args.repoId).eq('state', args.state as 'open' | 'closed'),
                )
                .order('desc')
                .paginate(args.paginationOpts)
        }

        // Fallback: paginate by repo only
        return ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) => q.eq('repoId', args.repoId))
            .order('desc')
            .paginate(args.paginationOpts)
    },
}

export const getByRepoAndNumber = protectedQuery({
    args: { repoId: v.id('repos'), number: v.number() },
    handler: (ctx, { repoId, number }) => Issues.getByRepoAndNumber(ctx, { repoId, number }),
})

export const listByRepo = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Issues.listByRepo(ctx, repoId),
})
