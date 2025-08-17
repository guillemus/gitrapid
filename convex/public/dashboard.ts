import { api } from '@convex/_generated/api'
import { action, query, type ActionCtx } from '@convex/_generated/server'
import { RepoDownloadStatus } from '@convex/models/repoDownloadStatus'
import { UserRepos } from '@convex/models/userRepos'
import { newOctokit, validatePublicLicense, type LicenseError } from '@convex/services/github'
import { err, ok, wrap } from '@convex/shared'
import { getUserId, octoCatch, SECRET } from '@convex/utils'
import { v } from 'convex/values'

export const get = query({
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

export const getDownloadStatus = query({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, { repoId }) {
        let userId = await getUserId(ctx)

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, repoId)
        if (!hasRepo) {
            throw new Error('not authorized to this repo')
        }

        let status = await RepoDownloadStatus.getByRepoId(ctx, repoId)
        if (!status) return

        return {
            status: status.status,
            message: status.message,
        }
    },
})

async function getTokenFromUser(ctx: ActionCtx): R<string> {
    let userId = await getUserId(ctx)

    let token = await ctx.runQuery(api.models.pats.getByUserId, {
        ...SECRET,
        userId,
    })
    if (!token) return err('No PAT found')

    return ok(token.token)
}

export type FoundRepo = {
    url: string
    owner: string
    repo: string
    description: string
}

export const searchRepo = action({
    args: {
        query: v.string(),
    },
    async handler(ctx, args): R<FoundRepo[]> {
        let { query } = args
        let token = await getTokenFromUser(ctx)
        if (token.isErr) {
            return wrap('Failed to get token', token)
        }

        let octo = newOctokit(token.val)
        let res = await octoCatch(octo.rest.search.repos({ q: query }))
        if (res.isErr) return err(res.err.error())

        let repos: FoundRepo[] = []
        for (let repo of res.val.items) {
            if (repo.owner && repo.name) {
                repos.push({
                    owner: repo.owner.login,
                    repo: repo.name,
                    description: repo.description ?? '',
                    url: repo.html_url,
                })
            }
        }

        return ok(repos)
    },
})

type AddRepoError = LicenseError | { type: 'error'; err: string }

export const addRepo = action({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, args): R<null, AddRepoError> {
        let token = await getTokenFromUser(ctx)
        if (token.isErr) return err({ type: 'error', err: token.err })
        let octo = newOctokit(token.val)

        let repoData = await octoCatch(
            octo.rest.repos.get({
                owner: args.owner,
                repo: args.repo,
            }),
        )
        if (repoData.isErr) {
            return err({ type: 'octo-error', err: repoData.err })
        }

        let license = await validatePublicLicense(octo, {
            owner: args.owner,
            repo: args.repo,
        })
        if (license.isErr) return license

        await ctx.scheduler.runAfter(0, api.services.backfill.run, {
            ...SECRET,
            token: token.val,
            owner: args.owner,
            repo: args.repo,
            private: repoData.val.private,
        })

        return ok()
    },
})
