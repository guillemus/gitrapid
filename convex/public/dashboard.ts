import { api, internal } from '@convex/_generated/api'
import { action, mutation, query } from '@convex/_generated/server'
import { runMutation, runQuery } from '@convex/localcx'
import { doesRepoNeedSyncing } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { getTokenFromUserId, getUserId } from '@convex/services/auth'
import { newOctokit, octoCatch, parseGithubUrl } from '@convex/services/github'
import { err, ok, wrap } from '@convex/shared'
import { logger } from '@convex/utils'
import { v } from 'convex/values'

export const get = query({
    args: {},
    async handler(ctx) {
        let userId = await getUserId(ctx)
        let userRepos = await UserRepos.getUserRepoIds(ctx, userId)

        let repoIds = userRepos.map((ur) => ur.repoId)
        let repos = await Promise.all(repoIds.map((id) => ctx.db.get(id)))
        return repos.filter((r) => r !== null)
    },
})

export const getDownload = query({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, { repoId }) {
        let userId = await getUserId(ctx)

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, repoId)
        if (!hasRepo) {
            throw new Error('not authorized to this repo')
        }

        let repo = await ctx.db.get(repoId)
        if (!repo) return null

        return {
            status: repo.download.status,
            message: repo.download.message,
        }
    },
})

export type FoundRepo = {
    url: string
    owner: string
    repo: string
    description: string
}

export const addRepo = action({
    args: {
        githubUrl: v.string(),
    },

    async handler(ctx, args): R {
        let userId = await getUserId(ctx)

        api.public.dashboard.getDownload
        api.models.authAccounts.getByProviderAndAccountId

        console.log('calling add repo')

        let token = await getTokenFromUserId(ctx, userId)
        if (token.isErr) {
            logger.error(`failed to get token for user ${userId}: ${token.err}`)
            return err('failed to get token')
        }

        let octo = newOctokit(token.val)

        let parsed = parseGithubUrl(args.githubUrl)
        if (parsed.isErr) {
            logger.error(`failed to parse github url for user ${userId}: ${parsed.err}`)
            return wrap('failed to parse github url', parsed)
        }

        let { owner, repo } = parsed.val

        let repoData = await octoCatch(octo.rest.repos.get({ owner, repo }))
        if (repoData.isErr) {
            let errmsg = octoCatch.errToString(repoData)
            logger.error(`failed to get repo data for user ${userId}: ${errmsg}`)
            return err('failed to get repo data')
        }

        let repoId
        let savedRepo = await runQuery(ctx, api.models.repos.getByOwnerAndRepo, {
            owner,
            repo,
        })
        if (savedRepo) {
            // insert user repo
            await runMutation(ctx, api.models.userRepos.insertIfNotExists, {
                repoId: savedRepo._id,
                userId,
            })

            // if the repository already exists with a successful or eventually
            // successful status then we don't need to start a new sync
            if (!doesRepoNeedSyncing(savedRepo)) {
                return ok()
            }

            repoId = savedRepo._id
        } else {
            repoId = await runMutation(ctx, api.models.repos.insertNewRepoForUser, {
                userId,
                owner,
                repo,
                private: repoData.val.private,
            })
        }

        await ctx.scheduler.runAfter(0, internal.services.sync.startWorkflow, { userId, repoId })

        return ok()
    },
})

export const removeRepo = mutation({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        // Find and delete the userRepo association
        let userRepos = await UserRepos.getUserRepoIds(ctx, userId)
        let userRepo = userRepos.find((ur) => ur.repoId === args.repoId)
        if (!userRepo) {
            throw new Error('not authorized to this repo')
        }

        await UserRepos.deleteByRepoId(ctx, args.repoId)
        return null
    },
})
