import { query } from '@convex/_generated/server'
import { Issues } from '@convex/models/issues'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { getUserId, logger } from '@convex/utils'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const list = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        search: v.optional(v.string()),
        state: v.optional(v.union(v.literal('open'), v.literal('closed'))),
        sortBy: v.optional(
            v.union(v.literal('createdAt'), v.literal('updatedAt'), v.literal('comments')),
        ),
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let savedRepo = await Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (!savedRepo) return null

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, savedRepo._id)
        if (!hasRepo) return null

        let result = await Issues.paginate(ctx, {
            repoId: savedRepo._id,
            state: args.state,
            search: args.search,
            sortBy: args.sortBy,
            paginationOpts: args.paginationOpts,
        })

        return {
            ...result,
            repo: savedRepo,
        }
    },
})

export const getWithComments = query({
    args: {
        repoId: v.id('repos'),
        issueNumber: v.number(),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, args.repoId)
        if (!hasRepo) {
            throw new Error('not authorized to these issues')
        }

        let issue = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (i) =>
                i.eq('repoId', args.repoId).eq('number', args.issueNumber),
            )
            .unique()
        if (!issue) {
            logger.info({ userId }, 'No issue found for user')
            return null
        }

        let comments = await ctx.db
            .query('issueComments')
            .withIndex('by_issue', (c) => c.eq('issueId', issue._id))
            .collect()

        return {
            issue,
            comments,
        }
    },
})

export const searchByComments = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        search: v.string(),
        state: v.optional(v.union(v.literal('open'), v.literal('closed'))),
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let savedRepo = await Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (!savedRepo) return null

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, savedRepo._id)
        if (!hasRepo) return null

        // Search comments by body and map to issues
        let commentsRes = await ctx.db
            .query('issueComments')
            .withSearchIndex('search_issue_comments', (s) =>
                s.search('body', args.search).eq('repoId', savedRepo._id),
            )
            .paginate(args.paginationOpts)

        // Deduplicate issueIds then fetch issues, filtering by state if provided
        let ids = new Set(commentsRes.page.map((c) => c.issueId))
        let page = [] as any[]
        for (let id of ids) {
            let issue = await ctx.db.get(id)
            if (issue && (!args.state || issue.state === args.state)) page.push(issue)
        }

        return {
            page,
            continueCursor: commentsRes.continueCursor,
            isDone: commentsRes.isDone,
        }
    },
})
