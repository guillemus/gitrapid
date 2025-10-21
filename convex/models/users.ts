import { vWorkflowId } from '@convex-dev/workflow'
import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import { v_nextSyncAt, v_nullable, type PossibleGithubUser } from '@convex/schema'
import { type FnArgs } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { v, type Infer } from 'convex/values'
import { PATs } from './pats'

export namespace Users {
    export const get = {
        args: { userId: v.id('users') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this>) {
            return ctx.db.get(args.userId)
        },
    }

    export const list = {
        args: {},
        async handler(ctx: QueryCtx) {
            return ctx.db.query('users').collect()
        },
    }

    export const getOrCreateGithubUser = {
        args: { githubId: v.number(), login: v.string(), avatarUrl: v.string() },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let githubUser = await ctx.db
                .query('githubUsers')
                .withIndex('by_githubId', (u) => u.eq('githubId', args.githubId))
                .unique()
            if (githubUser) {
                return githubUser._id
            } else {
                let id = await ctx.db.insert('githubUsers', args)
                return id
            }
        },
    }

    export const getWorkflows = {
        args: { userId: v.id('users') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this>) {
            return ctx.db
                .query('userWorkflows')
                .withIndex('by_userId', (x) => x.eq('userId', args.userId))
                .unique()
        },
    }

    export const shouldSyncNotifs = {
        args: { userId: v.id('users') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this>) {
            let pat = await PATs.getByUserId.handler(ctx, { userId: args.userId })
            if (!pat) return false

            let userWorkflow = await ctx.db
                .query('userWorkflows')
                .withIndex('by_userId', (x) => x.eq('userId', args.userId))
                .unique()

            // if no userWorkflow found we can assume that nothing is being run,
            // safe to assume that we can start a sync
            if (!userWorkflow) return true

            let wStatus = await workflow.status(ctx, userWorkflow.syncNotifications.workflowId)
            if (wStatus.type === 'inProgress') return false

            return true
        },
    }

    export const saveNotifWorkflow = {
        args: {
            userId: v.id('users'),
            workflowId: vWorkflowId,
            nextSyncAt: v_nullable(v_nextSyncAt),
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let userWorkflow = await ctx.db
                .query('userWorkflows')
                .withIndex('by_userId', (q) => q.eq('userId', args.userId))
                .unique()

            if (userWorkflow) {
                userWorkflow.syncNotifications.workflowId = args.workflowId
                if (args.nextSyncAt) {
                    userWorkflow.syncNotifications.nextSyncAt = args.nextSyncAt
                }

                await ctx.db.patch(userWorkflow._id, userWorkflow)
                return
            }

            await ctx.db.insert('userWorkflows', {
                userId: args.userId,
                syncNotifications: {
                    nextSyncAt: args.nextSyncAt ?? undefined,
                    workflowId: args.workflowId,
                },
            })
        },
    }
}

export const list = internalQuery(Users.list)
export const get = internalQuery(Users.get)
export const getOrCreateGithubUser = internalMutation(Users.getOrCreateGithubUser)
export const saveNotifWorkflow = internalMutation(Users.saveNotifWorkflow)

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

export async function getOrCreatePossibleGithubUser(
    ctx: MutationCtx,
    args: PossibleGithubUserData,
): Promise<PossibleGithubUser> {
    if (args !== null && args !== 'github-actions') {
        let githubUserId = await Users.getOrCreateGithubUser.handler(ctx, args)
        return githubUserId
    }

    return args
}
