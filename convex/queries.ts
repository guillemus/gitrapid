import { v } from 'convex/values'
import { query } from './_generated/server'
import { Installations, Issues, Repos } from './models/models'
import { getRepoPageQuery } from './services/repoPageService'
import { getUserId, unwrap } from './utils'

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

        return Installations.listUserInstallations(ctx, userId)
    },
})

export const listIssues = query({
    args: {
        repoId: v.id('repos'),
        search: v.optional(v.string()),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let installation = await Installations.getByUserIdAndRepoId(ctx, userId, args.repoId)
        if (!installation) {
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

        let installation = await Installations.getByUserIdAndRepoId(ctx, userId, args.repoId)
        if (!installation) {
            throw new Error('not authorized to these issues')
        }

        let issue = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (i) =>
                i.eq('repoId', args.repoId).eq('number', args.issueNumber),
            )
            .unique()
        if (!issue) {
            console.log('No issue found for user', userId)
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

        let installations = await Installations.listUserInstallations(ctx, userId)
        let data = []
        for (let installation of installations) {
            let repo = await Repos.get(ctx, installation.repoId)
            if (repo) {
                data.push({ repo, installation })
            }
        }

        return data
    },
})
