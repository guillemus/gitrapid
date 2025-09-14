import { getAuthUserId } from '@convex-dev/auth/server'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { type ActionCtx, type QueryCtx } from '@convex/_generated/server'
import { protectedQuery, runQuery } from '@convex/localcx'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { err, ok } from '@convex/shared'
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

export const hasUserAccessToRepo = protectedQuery({
    args: {
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
    },
    handler: (ctx, { userId, owner, repo }) => Auth.hasUserAccessToRepo(ctx, userId, owner, repo),
})

export async function getUserId(ctx: { auth: ConvexAuth }) {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
        throw new Error('User not authenticated')
    }

    return userId
}

export async function getTokenFromUserId(ctx: ActionCtx, userId: Id<'users'>): R<string> {
    let token = await runQuery(ctx, api.models.pats.getByUserId, {
        userId,
    })
    if (!token) return err('No PAT found')

    return ok(token.token)
}
