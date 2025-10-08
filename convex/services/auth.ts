import { getAuthUserId } from '@convex-dev/auth/server'
import { internal } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { internalQuery, type ActionCtx, type QueryCtx } from '@convex/_generated/server'
import { PATs } from '@convex/models/pats'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { err, ok } from '@convex/shared'
import type { FnArgs } from '@convex/utils'
import { assert } from 'convex-helpers'
import type { Auth as ConvexAuth } from 'convex/server'
import { v } from 'convex/values'

export namespace Auth {
    // get's the user repository if associated with him
    export const getUserAssociatedRepo = {
        args: {
            userId: v.id('users'),
            owner: v.string(),
            repo: v.string(),
        },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            let savedRepo = await Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
            if (!savedRepo) return err('repo-not-found')

            let hasRepo = await UserRepos.userHasRepo(ctx, args.userId, savedRepo._id)
            if (!hasRepo) return err('user-repo-not-found')

            return ok(savedRepo)
        },
    }

    export async function getUserId(ctx: { auth: ConvexAuth }) {
        const userId = await getAuthUserId(ctx)
        assert(userId, 'not authenticated')

        return userId
    }

    export async function getUserWithTokenAndAssociatedRepo(
        ctx: QueryCtx,
        owner: string,
        repo: string,
    ) {
        let userId = await getUserId(ctx)
        let pat = await PATs.getByUserId.handler(ctx, { userId })
        if (!pat) return err('PAT_NOT_FOUND')
        if (new Date(pat.expiresAt) < new Date()) return err('PAT_EXPIRED')

        let userRepo = await getUserAssociatedRepo.handler(ctx, { userId, owner, repo })
        if (userRepo.isErr) return userRepo

        return ok({ userId, pat, userRepo: userRepo.val })
    }
}

export const getUserAssociatedRepo = internalQuery(Auth.getUserAssociatedRepo)

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
