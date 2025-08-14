import { v } from 'convex/values'
import { query } from './_generated/server'
import { Issues, Repos } from './models/models'
import { UserRepos } from './models/userRepos'
import { getRepoPageQuery } from './services/repoPageService'
import { getUserId, logger, protectedQuery, unwrap } from './utils'

export const getRepoPage = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let userId = await getUserId(ctx)
        let result = await getRepoPageQuery(ctx, userId, owner, repo, refAndPath)
        return unwrap(result)
    },
})

export const listInstalledRepos = query({
    async handler(ctx) {
        let userId = await getUserId(ctx)

        let repoIds = await UserRepos.getUserRepoIds(ctx, userId)
        let repos = await Repos.getByIds(
            ctx,
            repoIds.map((r) => r.repoId),
        )

        return repos
    },
})

export const listIssues = query({
    args: {
        repoId: v.id('repos'),
        search: v.optional(v.string()),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, args.repoId)
        if (!hasRepo) {
            throw new Error('not authorized to these issues')
        }

        return Issues.listByRepo(ctx, args.repoId)
    },
})

export const getIssueWithComments = query({
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

export const getDashboardPage = query({
    async handler(ctx) {
        let userId = await getUserId(ctx)

        let repoIds = await UserRepos.getUserRepoIds(ctx, userId)
        return Repos.getByIds(
            ctx,
            repoIds.map((r) => r.repoId),
        )
    },
})
