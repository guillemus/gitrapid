import { vWorkflowId } from '@convex-dev/workflow'
import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import type { PossibleGithubUser } from '@convex/schema'
import { type FnArgs } from '@convex/utils'
import { v, type Infer } from 'convex/values'

export namespace Users {
    export const get = {
        args: { userId: v.id('users') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            return ctx.db.get(args.userId)
        },
    }

    export const list = {
        args: {},
        async handler(ctx: QueryCtx) {
            return ctx.db.query('users').collect()
        },
    }

    export const upsertGithubUser = {
        args: { githubId: v.number(), login: v.string(), avatarUrl: v.string() },
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

    export const saveNotifWorkflowId = {
        args: { userId: v.id('users'), notifWorkflowId: vWorkflowId },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
            let userWorkflow = await ctx.db
                .query('userWorkflows')
                .withIndex('by_userId', (q) => q.eq('userId', args.userId))
                .unique()
            if (userWorkflow) {
                await ctx.db.patch(userWorkflow._id, { notifWorkflowId: args.notifWorkflowId })
                return
            }

            let id = await ctx.db.insert('userWorkflows', {
                userId: args.userId,
                notifWorkflowId: args.notifWorkflowId,
                issueWorkflowIds: [],
            })
            return id
        },
    }
}

export const list = internalQuery(Users.list)
export const get = internalQuery(Users.get)
export const upsertGithubUser = internalMutation(Users.upsertGithubUser)

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
        let githubUserId = await Users.upsertGithubUser.handler(ctx, args)
        return githubUserId
    }

    return args
}
