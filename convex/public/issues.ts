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
            v.union(
                v.literal('createdAt'),
                v.literal('updatedAt'),
                v.literal('comments'),
                v.literal('number'),
            ),
        ),
        order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
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
            state: args.state ?? undefined,
            search: args.search ?? undefined,
            sortBy: args.sortBy ?? undefined,
            order: args.order ?? undefined,
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
