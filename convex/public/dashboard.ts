import { internal } from '@convex/_generated/api'
import { action, internalMutation, mutation, query } from '@convex/_generated/server'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { Auth, getTokenFromUserId } from '@convex/services/auth'
import { newOctokit, octoCatch, parseGithubUrl } from '@convex/services/github'
import { err, ok, wrap } from '@convex/shared'
import { logger } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { assert } from 'convex-helpers'
import { v } from 'convex/values'

export const get = query({
    args: {},
    async handler(ctx) {
        let userId = await Auth.getUserId(ctx)
        let userRepos = await UserRepos.getUserRepoIds(ctx, userId)

        let repoIds = userRepos.map((ur) => ur.repoId)
        let repos = await Promise.all(repoIds.map((id) => ctx.db.get(id)))
        return repos.filter((r) => r !== null)
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
        let userId = await Auth.getUserId(ctx)
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
        let savedRepo = await ctx.runQuery(internal.models.repos.getByOwnerAndRepo, {
            owner,
            repo,
        })
        if (savedRepo) {
            // insert user repo
            await ctx.runMutation(internal.models.userRepos.insertIfNotExists, {
                repoId: savedRepo._id,
                userId,
            })

            repoId = savedRepo._id
        } else {
            repoId = await ctx.runMutation(internal.models.repos.upsertRepoForUser, {
                userId,
                owner,
                repo,
                private: repoData.val.private,
            })
        }

        await ctx.scheduler.runAfter(0, internal.services.sync.startSyncRepoIssues, {
            userId,
            repoId,
        })

        return ok()
    },
})

export const saveNewRepo = internalMutation({
    args: {
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        let repoId

        let savedRepo = await Repos.getByOwnerAndRepo.handler(ctx, {
            owner: args.owner,
            repo: args.repo,
        })
        if (savedRepo) {
            // insert user repo
            await UserRepos.insertIfNotExists.handler(ctx, {
                userId: args.userId,
                repoId: savedRepo._id,
            })

            repoId = savedRepo._id
        } else {
            repoId = await Repos.upsertRepoForUser.handler(ctx, {
                userId: args.userId,
                owner: args.owner,
                repo: args.repo,
                private: args.private,
            })
        }

        await ctx.scheduler.runAfter(0, internal.services.sync.startSyncRepoIssues, {
            userId: args.userId,
            repoId,
        })
    },
})

export const removeRepo = mutation({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)

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

export const getDownloadStatus = query({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)
        let userRepo = await UserRepos.userHasRepo(ctx, userId, args.repoId)
        assert(userRepo, 'not authorized to this repo')

        let repoWorkflow = await Repos.getWorkflow.handler(ctx, { repoId: args.repoId })
        if (!repoWorkflow) {
            return null
        }

        let wStatus = await workflow.status(ctx, repoWorkflow.issues.workflowId)

        return wStatus.type
    },
})
