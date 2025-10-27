import { getAuthUserId } from '@convex-dev/auth/server'
import type { Id } from '@convex/_generated/dataModel'
import { internalQuery, type QueryCtx } from '@convex/_generated/server'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { Users } from '@convex/models/users'
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
        async handler(ctx: QueryCtx, args: FnArgs<typeof this>) {
            let savedRepo = await Repos.getByOwnerAndRepo.handler(ctx, {
                owner: args.owner,
                repo: args.repo,
            })
            if (!savedRepo) return err('repo-not-found')

            let hasRepo = await UserRepos.userHasRepo(ctx, args.userId, savedRepo._id)
            if (!hasRepo) return err('user-repo-not-found')

            return ok(savedRepo)
        },
    }

    export async function getUserId(ctx: { auth: ConvexAuth }) {
        const userId = await getAuthUserId(ctx)
        assert(userId, `${getUserId.name}: ctx not authenticated`)

        return userId
    }

    export async function getUserWithTokenAndAssociatedRepo(
        ctx: QueryCtx,
        userId: Id<'users'>,
        owner: string,
        repo: string,
    ) {
        let user = await Users.get.handler(ctx, { userId })
        assert(user, 'user not found')

        let userRepo = await getUserAssociatedRepo.handler(ctx, { userId, owner, repo })
        if (userRepo.isErr) return userRepo

        return ok({ userId, user, userRepo: userRepo.val })
    }
}

export const getUserAssociatedRepo = internalQuery(Auth.getUserAssociatedRepo)
