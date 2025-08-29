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
            sortBy?: 'createdAt' | 'updatedAt' | 'comments'
            paginationOpts: {
                numItems: number
                cursor: string | null
            }
        },
    ) {
        // If search is provided, use search index with optional state filter
        if (args.search && args.search.trim().length > 0) {
            let search = args.search
            return ctx.db.query('issues').withSearchIndex('search_issues', (s) => {
                let scoped = s.search('title', search).eq('repoId', args.repoId)
                if (args.state) {
                    return scoped.eq('state', args.state)
                }
                return scoped
            })
        }

        let sortBy = args.sortBy ?? 'createdAt'

        // No search term; choose index based on sort and whether state filter is present
        if (args.state) {
            let issueState = args.state

            if (sortBy === 'createdAt') {
                return ctx.db
                    .query('issues')
                    .withIndex('by_repo_state_createdAt', (q) =>
                        q.eq('repoId', args.repoId).eq('state', issueState),
                    )
                    .order('desc')
                    .paginate(args.paginationOpts)
            }

            if (sortBy === 'updatedAt') {
                return ctx.db
                    .query('issues')
                    .withIndex('by_repo_state_updatedAt', (q) =>
                        q.eq('repoId', args.repoId).eq('state', issueState),
                    )
                    .order('desc')
                    .paginate(args.paginationOpts)
            }

            if (sortBy === 'comments') {
                return ctx.db
                    .query('issues')
                    .withIndex('by_repo_state_comments', (q) =>
                        q.eq('repoId', args.repoId).eq('state', issueState),
                    )
                    .order('desc')
                    .paginate(args.paginationOpts)
            }

            // default to number order when explicitly requested or fallback
            return ctx.db
                .query('issues')
                .withIndex('by_repo_state_number', (q) =>
                    q.eq('repoId', args.repoId).eq('state', issueState),
                )
                .order('desc')
                .paginate(args.paginationOpts)
        }

        // No state filter
        if (sortBy === 'createdAt') {
            return ctx.db
                .query('issues')
                .withIndex('by_repo_createdAt', (q) => q.eq('repoId', args.repoId))
                .order('desc')
                .paginate(args.paginationOpts)
        }

        if (sortBy === 'updatedAt') {
            return ctx.db
                .query('issues')
                .withIndex('by_repo_updatedAt', (q) => q.eq('repoId', args.repoId))
                .order('desc')
                .paginate(args.paginationOpts)
        }

        if (sortBy === 'comments') {
            return ctx.db
                .query('issues')
                .withIndex('by_repo_comments', (q) => q.eq('repoId', args.repoId))
                .order('desc')
                .paginate(args.paginationOpts)
        }

        // default to number
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
