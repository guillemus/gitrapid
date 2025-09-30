import type { Id } from '@convex/_generated/dataModel'
import { internalQuery, type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import type { PossibleGithubUser } from '@convex/schema'
import type { FnArgs } from '@convex/utils'
import { v, type Infer } from 'convex/values'

export const Users = {
    async get(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db.get(userId)
    },
    async list(ctx: QueryCtx) {
        return ctx.db.query('users').collect()
    },
}

export const list = internalQuery({
    args: {},
    handler: (ctx) => Users.list(ctx),
})

const UpsertGithubUser = {
    args: {
        githubId: v.number(),
        login: v.string(),
        avatarUrl: v.string(),
    },
    async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
        let githubUser = await ctx.db
            .query('githubUsers')
            .withIndex('by_githubId', (u) => u.eq('githubId', args.githubId))
            .unique()
        if (githubUser) {
            await ctx.db.patch(githubUser._id, args)
            return githubUser._id
        } else {
            let id = await ctx.db.insert('githubUsers', args)
            return id
        }
    },
}

export const possibleGithubUserData = v.union(
    v.null(),
    v.literal('github-actions'),
    v.object({
        githubId: v.number(),
        login: v.string(),
        avatarUrl: v.string(),
    }),
)

type PossibleGithubUserData = Infer<typeof possibleGithubUserData>

export async function upsertPossibleGithubUser(
    ctx: MutationCtx,
    args: PossibleGithubUserData,
): Promise<PossibleGithubUser> {
    if (args !== null && args !== 'github-actions') {
        let githubUserId = await UpsertGithubUser.handler(ctx, args)
        return githubUserId
    }

    return args
}
