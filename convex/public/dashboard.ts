import { api } from '@convex/_generated/api'
import { action, mutation, query } from '@convex/_generated/server'
import { doesRepoNeedSyncing } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { getTokenFromUserId, getUserId } from '@convex/services/auth'
import {
    newOctokit,
    parseGithubUrl,
    validatePublicLicense,
    type LicenseError,
} from '@convex/services/github'
import { err, ok } from '@convex/shared'
import { logger, octoCatch, SECRET } from '@convex/utils'
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

type AddRepoError = LicenseError | { type: 'error'; err: string }

export const addRepo = action({
    args: {
        githubUrl: v.string(),
    },

    async handler(ctx, args): R<null, AddRepoError> {
        let userId = await getUserId(ctx)

        console.log('calling add repo')

        let token = await getTokenFromUserId(ctx, userId)
        if (token.isErr) return err({ type: 'error', err: token.err })

        let octo = newOctokit(token.val)

        let parsed = parseGithubUrl(args.githubUrl)
        if (parsed.isErr) return err({ type: 'error', err: parsed.err })

        let { owner, repo } = parsed.val

        let repoData = await octoCatch(octo.rest.repos.get({ owner, repo }))
        if (repoData.isErr) {
            return err({ type: 'octo-error', err: repoData.err.error() })
        }

        // if the repository is private and we could fetch its data with the
        // given token, that means that the user has access to the repository,
        // which means that we should have his permission to access the private
        // data.
        if (!repoData.val.private) {
            let license = await validatePublicLicense({ octo }, { owner, repo })
            if (license.isErr) return license
        }

        logger.info('license is valid')

        let savedRepo = await ctx.runQuery(api.models.repos.getByOwnerAndRepo, {
            ...SECRET,
            owner,
            repo,
        })
        if (savedRepo) {
            // insert user repo
            await ctx.runMutation(api.models.userRepos.insertIfNotExists, {
                ...SECRET,
                repoId: savedRepo._id,
                userId,
            })

            // if the repository already exists with a successful or eventually
            // successful status then we don't need to start a new sync
            if (!doesRepoNeedSyncing(savedRepo)) {
                return ok()
            }
        } else {
            let repoId = await ctx.runMutation(api.models.repos.insert, {
                ...SECRET,
                owner,
                repo,
                private: repoData.val.private,
                openIssues: 0,
                closedIssues: 0,
                openPullRequests: 0,
                closedPullRequests: 0,
                download: {
                    status: 'initial',
                },
            })

            await ctx.runMutation(api.models.userRepos.insertIfNotExists, {
                ...SECRET,
                repoId,
                userId,
            })
        }

        await ctx.scheduler.runAfter(0, api.services.sync.runSingle, {
            ...SECRET,
            fetchRepoBy: {
                type: 'by-owner-repo',
                owner,
                repo,
            },
            userId,
            backfill: true,
        })

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
