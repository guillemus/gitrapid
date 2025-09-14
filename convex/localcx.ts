// utilities to make it possible to run convex functions locally

import { ConvexHttpClient } from 'convex/browser'
import { action, mutation, query, type ActionCtx } from './_generated/server'
import { appEnv } from './env'

export function createActionCtx(): ActionCtx {
    let httpClient = new ConvexHttpClient(appEnv.CONVEX_SITE_URL)

    // @ts-ignore
    return {
        runQuery: async (query, args) => {
            return httpClient.query(query as any, args)
        },
        runMutation: async (mutation, args) => {
            return httpClient.mutation(mutation as any, args)
        },
        runAction: async (action, args) => {
            return httpClient.action(action as any, args)
        },
    }
}

import type { WorkflowStep } from '@convex-dev/workflow'
import { customAction, customMutation, customQuery } from 'convex-helpers/server/customFunctions'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { v } from 'convex/values'

export const protectedQuery = customQuery(query, {
    args: { secret: v.string() },
    async input(ctx, args) {
        if (args.secret !== appEnv.SECRET) throw new Error('>:(')
        return { ctx, args: {} }
    },
})

export const protectedMutation = customMutation(mutation, {
    args: { secret: v.string() },
    async input(ctx, args) {
        if (args.secret !== appEnv.SECRET) throw new Error('>:(')
        return { ctx, args: {} }
    },
})

export const protectedAction = customAction(action, {
    args: { secret: v.string() },
    async input(ctx, args) {
        if (args.secret !== appEnv.SECRET) throw new Error('>:(')
        return { ctx, args: {} }
    },
})

export async function runQuery<
    Query extends FunctionReference<'query', 'public' | 'internal', { secret: string }>,
>(
    ctx: ActionCtx | WorkflowStep,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-ignore
    return ctx.runQuery(query, { ...args, secret: appEnv.SECRET })
}

export async function runMutation<
    Query extends FunctionReference<'mutation', 'public' | 'internal', { secret: string }>,
>(
    ctx: ActionCtx | WorkflowStep,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-ignore
    return ctx.runMutation(query, { ...args, secret: appEnv.SECRET })
}

export async function runAction<
    Query extends FunctionReference<'action', 'public' | 'internal', { secret: string }>,
>(
    ctx: ActionCtx | WorkflowStep,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-ignore
    return ctx.runAction(query, { ...args, secret: appEnv.SECRET })
}
