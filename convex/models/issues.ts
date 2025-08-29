import type { Doc, Id } from '@convex/_generated/dataModel'
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
        // If search is provided, search issues by title and comments by body, then merge
        if (args.search && args.search.trim().length > 0) {
            let search = args.search
            let issuesQ = ctx.db.query('issues').withSearchIndex('search_issues', (s) => {
                let scoped = s.search('title', search).eq('repoId', args.repoId)
                if (args.state) {
                    return scoped.eq('state', args.state)
                }
                return scoped
            })

            let issuesResP = issuesQ.paginate(args.paginationOpts)

            // Search comments by body scoped by repoId; small buffer to enrich results
            let commentsRes = await ctx.db
                .query('issueComments')
                .withSearchIndex('search_issue_comments', (s) =>
                    s.search('body', search).eq('repoId', args.repoId),
                )
                .paginate({ numItems: args.paginationOpts.numItems * 3, cursor: null })

            let commentIssueIdSet = new Set<string>()
            for (let c of commentsRes.page) commentIssueIdSet.add(c.issueId)

            let commentIssues: Doc<'issues'>[] = []
            for (let id of commentIssueIdSet) {
                let it = await ctx.db.get(id as Id<'issues'>)
                if (it && (!args.state || it.state === args.state)) {
                    commentIssues.push(it)
                }
            }

            let issuesRes = await issuesResP

            // merge & dedupe
            let byId: Map<string, Doc<'issues'>> = new Map()
            for (let it of issuesRes.page) byId.set(it._id, it)
            for (let it of commentIssues) byId.set(it._id, it)

            let merged = Array.from(byId.values())

            let sortBy = args.sortBy ?? 'createdAt'
            if (sortBy === 'createdAt') {
                merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            } else if (sortBy === 'updatedAt') {
                merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            } else if (sortBy === 'comments') {
                merged.sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0))
            }

            let page = merged.slice(0, args.paginationOpts.numItems)

            return {
                page,
                continueCursor: issuesRes.continueCursor,
                isDone: issuesRes.isDone,
            }
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
