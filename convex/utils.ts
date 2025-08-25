/* eslint-disable */

import { getAuthUserId } from '@convex-dev/auth/server'
import { customAction, customMutation, customQuery } from 'convex-helpers/server/customFunctions'
import { ConvexHttpClient } from 'convex/browser'
import type {
    FunctionArgs,
    FunctionReference,
    FunctionReturnType,
    OptionalRestArgs,
    UserIdentity,
} from 'convex/server'
import { v } from 'convex/values'
import { RequestError } from 'octokit'
import pino from 'pino'
import type { ActionCtx } from './_generated/server'
import { action, mutation, query } from './_generated/server'
import { env } from './env'
import { err, ok, type Err, type Result } from './shared'

export interface Context {
    runQuery<Query extends FunctionReference<'query', 'internal' | 'public'>>(
        query: Query,
        ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>>
    runMutation<Mutation extends FunctionReference<'mutation', 'internal' | 'public'>>(
        mutation: Mutation,
        ...args: OptionalRestArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>>
}

export async function withExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 4,
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            if (attempt === maxRetries - 1) {
                logger.error(
                    { err: error },
                    `BACKOFF: Operation failed after ${maxRetries} attempts`,
                )
                throw error
            }

            const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s, 8s
            logger.warn(
                { err: error, attempt: attempt + 1, delay },
                'BACKOFF: attempt failed, retrying',
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }
    throw new Error('BACKOFF: Should not reach here')
}

type Auth = {
    getUserIdentity: () => Promise<UserIdentity | null>
}

export async function getUserId(ctx: { auth: Auth }) {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
        throw new Error('User not authenticated')
    }

    return userId
}

export class OctoError extends RequestError {
    constructor(err: RequestError) {
        super(err.message, err.status, err)
    }

    error(): string {
        return `octo request error: (status: ${this.status}) ${this.message}`
    }
}

export async function octoCatch<T>(promise: Promise<{ data: T }>): Promise<Result<T, OctoError>> {
    try {
        let res = await promise
        return ok(res.data)
    } catch (error) {
        if (error instanceof RequestError) {
            return err(new OctoError(error))
        }

        throw error
    }
}

export async function octoCatchFull<T>(promise: Promise<T>): Promise<Result<T, OctoError>> {
    try {
        let res = await promise
        return ok(res)
    } catch (error) {
        if (error instanceof RequestError) {
            return err(new OctoError(error))
        }

        throw error
    }
}

export function octoWrap(context: string, octoError: Err<OctoError>): Err<string> {
    return err(`${context}: ${octoError.err.error()}`)
}

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

export function runProtectedQuery<Query extends FunctionReference<'query', 'public' | 'internal'>>(
    this: ActionCtx,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-expect-error: hard to make ts happy
    return this.runQuery(query, { secret: SECRET.secret, ...args })
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
    if (isNaN(d.getTime())) {
        return err('invalid date')
    }

    return ok(d)
}
