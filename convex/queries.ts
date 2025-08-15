import { v } from 'convex/values'
import { query } from './_generated/server'
import { Issues } from './models/issues'
import { Repos } from './models/repos'
import { UserRepos } from './models/userRepos'
import { getRepoPageQuery } from './services/repoPageService'
import { getUserId, logger } from './utils'
import { unwrap } from './shared'

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
    args: {},
    async handler(ctx) {
        let userId = await getUserId(ctx)
        let userRepos = await ctx.db
            .query('userRepos')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId))
            .collect()

        let repoIds = userRepos.map((ur) => ur.repoId)
        let repos = await Promise.all(repoIds.map((id) => ctx.db.get(id)))
        return repos.filter((r) => r !== null)
    },
})

export const getPAT = query({
    args: {},
    async handler(ctx) {
        let userId = await getUserId(ctx)
        let pat = await ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', userId))
            .unique()

        if (!pat) return null

        return {
            scopes: pat.scopes,
            expiresAt: pat.expiresAt,
        }
    },
})
