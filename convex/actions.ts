import { v } from 'convex/values'
import { Octokit } from 'octokit'
import { api } from './_generated/api'
import { action, type ActionCtx } from './_generated/server'
import { scopesSchema } from './schema'
import { Backfill } from './services/backfill'
import { getTokenExpiration, validatePublicLicense, type LicenseError } from './services/github'
import { err, ok, unwrap, wrap } from './shared'
import { getUserId, logger, octoCatch, protectedAction, SECRET } from './utils'

export const savePAT = action({
    args: {
        token: v.string(),
        scopes: scopesSchema,
    },
    async handler(ctx, { token, scopes }): R {
        let userId = await getUserId(ctx)

        let expiresAt = await getTokenExpiration(token)
        if (expiresAt.isErr) {
            return wrap('Failed to validate token', expiresAt)
        }

        // Save to database
        await ctx.runMutation(api.models.pats.upsertForUser, {
            ...SECRET,
            userId,
            token,
            scopes,
            expiresAt: expiresAt.val.toISOString(),
        })

        return ok()
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

export const searchRepository = action({
    args: {
        query: v.string(),
    },
    async handler(ctx, args): R<FoundRepo[]> {
        let { query } = args
        let token = await getTokenFromUser(ctx)
        if (token.isErr) {
            return wrap('Failed to get token', token)
        }

        let octo = new Octokit({ auth: token.val })
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

export const runRepoBackfill = protectedAction({
    args: {
        token: v.string(),
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        let octo = new Octokit({ auth: args.token })

        let res = await Backfill.run({
            ctx,
            octo,
            owner: args.owner,
            repo: args.repo,
            private: args.private,
        })
        unwrap(res)
    },
})

type AddRepoError = LicenseError | { type: 'error'; err: string }

export const addRepository = action({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, args): R<null, AddRepoError> {
        let token = await getTokenFromUser(ctx)
        if (token.isErr) return err({ type: 'error', err: token.err })
        let octo = new Octokit({ auth: token.val })

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

        await ctx.scheduler.runAfter(0, api.actions.runRepoBackfill, {
            ...SECRET,
            token: token.val,
            owner: args.owner,
            repo: args.repo,
            private: repoData.val.private,
        })

        return ok()
    },
})
