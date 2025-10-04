import { getAuthUserId } from '@convex-dev/auth/server'
import { internal } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { internalQuery, type ActionCtx, type QueryCtx } from '@convex/_generated/server'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { err, ok } from '@convex/shared'
import { assert } from 'convex-helpers'
import type { Auth as ConvexAuth } from 'convex/server'
import { v } from 'convex/values'

export const Auth = {
    async hasUserAccessToRepo(ctx: QueryCtx, userId: Id<'users'>, owner: string, repo: string) {
        let savedRepo = await Repos.getByOwnerAndRepo(ctx, owner, repo)
        if (!savedRepo) return err('repo-not-found' as const)

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, savedRepo._id)
        if (!hasRepo) return err('user-repo-not-found' as const)

        return ok(savedRepo)
    },
}

export const hasUserAccessToRepo = internalQuery({
    args: {
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
    },
    handler: (ctx, { userId, owner, repo }) => Auth.hasUserAccessToRepo(ctx, userId, owner, repo),
})

export async function getUserId(ctx: { auth: ConvexAuth }) {
    const userId = await getAuthUserId(ctx)
    assert(userId, 'not authenticated')

    return userId
}

export async function getGithubUserId(ctx: { auth: ConvexAuth }) {
    let userIdentity = await ctx.auth.getUserIdentity()
    let githubUserId = userIdentity?.subject
    assert(githubUserId, 'not authenticated')

    let res = Number(githubUserId)
    assert(!Number.isNaN(res), 'not authenticated')

    return res
}

export async function getTokenFromUserId(ctx: ActionCtx, userId: Id<'users'>): R<Doc<'pats'>> {
    let token = await ctx.runQuery(internal.models.pats.getByUserId, {
        userId,
    })
    if (!token) return err('No PAT found')

    return ok(token)
}

export function canUserCommentOnRepo(repo: Doc<'repos'>, token: Doc<'pats'>) {
    if (token.scopes.includes('repo')) return true

    if (token.scopes.includes('public_repo')) {
        return !repo.private
    }

    return false
}
