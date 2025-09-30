import type { Id } from '@convex/_generated/dataModel'
import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import type { FnArgs } from '@convex/utils'
import { assert } from 'convex-helpers'
import { v } from 'convex/values'

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

    async search(ctx: QueryCtx, repoId: Id<'repos'>, CAP: number, q: string) {
        let matches = await ctx.db
            .query('issues')
            .withSearchIndex('search_issues', (s) => s.search('title', q).eq('repoId', repoId))
            .take(CAP)

        return matches
    },

    async paginate(
        ctx: QueryCtx,
        args: {
            repoId: Id<'repos'>
            state?: 'open' | 'closed'
            sortBy?: 'createdAt' | 'updatedAt' | 'comments'
            paginationOpts: {
                numItems: number
                cursor: string | null
            }
        },
    ) {
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

export const getByRepoAndNumber = internalQuery({
    args: { repoId: v.id('repos'), number: v.number() },
    handler: (ctx, { repoId, number }) => Issues.getByRepoAndNumber(ctx, { repoId, number }),
})

export const listByRepo = internalQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Issues.listByRepo(ctx, repoId),
})

export const insertOpenUserIssueWithBody = internalMutation({
    args: {
        repoId: v.id('repos'),
        githubId: v.number(),
        number: v.number(),
        title: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
        closedAt: v.optional(v.string()),
        comments: v.optional(v.number()),
        body: v.string(),
    },
    async handler(ctx, args) {
        let useridentity = await ctx.auth.getUserIdentity()
        let githubUserId = useridentity?.subject
        assert(githubUserId, 'not authenticated')

        let githubUserIdNum = parseInt(githubUserId)

        let ghUser = await ctx.db
            .query('githubUsers')
            .withIndex('by_githubId', (u) => u.eq('githubId', githubUserIdNum))
            .unique()
        assert(ghUser, 'github user not found')

        let issueId = await ctx.db.insert('issues', {
            author: ghUser._id,
            createdAt: args.createdAt,
            githubId: args.githubId,
            number: args.number,
            repoId: args.repoId,
            title: args.title,
            state: 'open',
            updatedAt: args.updatedAt,
        })
        await ctx.db.insert('issueBodies', {
            repoId: args.repoId,
            issueId: issueId,
            body: args.body,
        })
    },
})

export const AssignUserToIssue = {
    args: {
        issueId: v.id('issues'),
        githubId: v.number(),
        login: v.string(),
        avatarUrl: v.string(),
    },
    async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
        let githubUserId: Id<'githubUsers'>
        let githubUser = await ctx.db
            .query('githubUsers')
            .withIndex('by_githubId', (u) => u.eq('githubId', args.githubId))
            .unique()
        if (githubUser) {
            await ctx.db.patch(githubUser._id, {
                login: args.login,
                avatarUrl: args.avatarUrl,
            })
            githubUserId = githubUser._id
        } else {
            githubUserId = await ctx.db.insert('githubUsers', {
                githubId: args.githubId,
                login: args.login,
                avatarUrl: args.avatarUrl,
            })
        }

        let currAssignees = await ctx.db
            .query('issueAssignees')
            .withIndex('by_issue_id', (q) => q.eq('issueId', args.issueId))
            .collect()
        let isAssigned = currAssignees.some((a) => a.assigneeId === githubUserId)
        if (!isAssigned) {
            await ctx.db.insert('issueAssignees', {
                issueId: args.issueId,
                assigneeId: githubUserId,
            })
        }
    },
}

export const AssignLabelToIssue = {
    args: {
        repoId: v.id('repos'),
        issueId: v.id('issues'),
        githubId: v.string(),
        name: v.string(),
        color: v.string(),
    },
    async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
        let labelId: Id<'labels'>
        let repoLabels = await ctx.db
            .query('labels')
            .withIndex('by_repoId', (l) => l.eq('repoId', args.repoId))
            .collect()
        let currLabel = repoLabels.find((l) => l.githubId === args.githubId)
        if (currLabel) {
            await ctx.db.patch(currLabel._id, {
                name: args.name,
                color: args.color,
            })
            labelId = currLabel._id
        } else {
            labelId = await ctx.db.insert('labels', {
                repoId: args.repoId,
                githubId: args.githubId,
                name: args.name,
                color: args.color,
            })
        }

        let currLabels = await ctx.db
            .query('issueLabels')
            .withIndex('by_issue_id', (q) => q.eq('issueId', args.issueId))
            .collect()
        let isLabeled = currLabels.some((l) => l.labelId === labelId)
        if (!isLabeled) {
            await ctx.db.insert('issueLabels', {
                issueId: args.issueId,
                labelId: labelId,
            })
        }
    },
}
