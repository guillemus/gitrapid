/* eslint-disable */

import { customAction, customMutation, customQuery } from 'convex-helpers/server/customFunctions'
import { ConvexHttpClient } from 'convex/browser'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { v } from 'convex/values'
import pino from 'pino'
import { z } from 'zod'
import type { ActionCtx } from './_generated/server'
import { action, mutation, query } from './_generated/server'
import { env } from './env'
import { err, ok, type Result } from './shared'

export function createActionCtx(publicContextUrl: string): ActionCtx {
    const client = new ConvexHttpClient(publicContextUrl)

    return {
        runQuery: async (query, ...args) => {
            // @ts-expect-error: hard to make ts happy
            return await client.query(query, ...args)
        },
        runMutation: async (mutation, ...args) => {
            // @ts-expect-error: hard to make ts happy
            return await client.mutation(mutation, ...args)
        },
        runAction: async (action, ...args) => {
            // @ts-expect-error: hard to make ts happy
            return await client.action(action, ...args)
        },

        get auth(): any {
            throw new Error('not implemented')
        },

        scheduler: {
            runAfter: async (delay, action, ...args) => {
                let cancelId = setTimeout(() => {
                    // @ts-expect-error: hard to make ts happy
                    client.action(action, ...args)
                }, delay)

                // We should not use this
                return cancelId as any
            },
            runAt: async (_date, _action, ..._args) => {
                throw new Error('not implemented')
            },
            cancel: async (_id) => {
                throw new Error('not implemented')
            },
        },
        get storage(): any {
            throw new Error('not implemented')
        },
        get vectorSearch(): any {
            throw new Error('not implemented')
        },
    }
}

export const SECRET = { secret: env.AUTH_GITHUB_WEBHOOK_SECRET! }

export function protectFn(args: { secret: string }) {
    if (args.secret !== env.AUTH_GITHUB_WEBHOOK_SECRET) {
        throw new Error('>:(') // security by obscurity
    }
}

export const protectedQuery = customQuery(query, {
    args: { secret: v.string() },
    async input(_ctx, args) {
        protectFn(args)
        return { ctx: {}, args: {} }
    },
})

export const protectedMutation = customMutation(mutation, {
    args: { secret: v.string() },
    async input(_ctx, args) {
        protectFn(args)
        return { ctx: {}, args: {} }
    },
})

export const protectedAction = customAction(action, {
    args: { secret: v.string() },
    async input(_ctx, args) {
        protectFn(args)
        return { ctx: {}, args: {} }
    },
})

export const logger = env.DEBUG_LOGGER ? debugLogger() : pino({ level: 'info' })

function debugLogger() {
    return pino({
        level: 'debug',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname,time',
            },
        },
    })
}

function preventInProd() {
    if (process.env.DEV !== 'true') throw new Error('>:(')
}

export const devQuery = customQuery(query, {
    args: {},
    async input(_ctx) {
        preventInProd()

        return { ctx: {}, args: {} }
    },
})

export const devMutation = customMutation(mutation, {
    args: {},
    async input(_ctx) {
        preventInProd()

        return { ctx: {}, args: {} }
    },
})

export const devAction = customAction(action, {
    args: {},
    async input(_ctx) {
        preventInProd()

        return { ctx: {}, args: {} }
    },
})

export function parseDate(date: string): Result<Date> {
    let d = new Date(date)
    if (Number.isNaN(d.getTime())) {
        return err('invalid date')
    }

    return ok(d)
}

export const Protected = {
    runQuery: runProtectedQuery,
    runMutation: runProtectedMutation,
    runAction: runProtectedAction,
}

function runProtectedQuery<Query extends FunctionReference<'query', 'public' | 'internal'>>(
    ctx: ActionCtx,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-expect-error: hard to make ts happy
    return ctx.runQuery(query, { secret: SECRET.secret, ...args })
}

function runProtectedMutation<Query extends FunctionReference<'mutation', 'public' | 'internal'>>(
    ctx: ActionCtx,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-expect-error: hard to make ts happy
    return ctx.runMutation(query, { secret: SECRET.secret, ...args })
}

function runProtectedAction<Query extends FunctionReference<'action', 'public' | 'internal'>>(
    ctx: ActionCtx,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-expect-error: hard to make ts happy
    return ctx.runAction(query, { secret: SECRET.secret, ...args })
}

export function zodParse<T extends z.ZodTypeAny>(schema: T, value: unknown): Result<z.infer<T>> {
    let result = schema.safeParse(value)
    if (result.success) {
        return ok(result.data)
    }

    return err(z.prettifyError(result.error))
}
