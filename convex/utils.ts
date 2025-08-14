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
import type { ActionCtx } from './_generated/server'
import { action, mutation, query } from './_generated/server'
import { env } from './env'

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

export type Ok<T = null> = { isErr: false; val: T }
export type Err<E = string> = { isErr: true; error: E }
export type Result<T, E = string> = Ok<T> | Err<E>

/**
 * Convenient utility to create an Ok.
 */
export function ok(): Ok
export function ok<T>(val: T): Ok<T>
export function ok<T>(val?: T): Ok<T | null> {
    return { isErr: false, val: (val ?? null) as T | null }
}

/**
 * Convenient utility to create an Err.
 */
export function err<E>(msg: E): Err<E> {
    return { isErr: true, error: msg }
}

/**
 * Wraps an error with a context. While we could just use `err`, when doing error wrapping we could have a refactor like the following
 *
 * ```typescript
 *  function fn() {
 *      return err("error happened")
 *  }
 *
 *  function someFunc() {
 *      let data = fn()
 *      if (isErr(data)) {
 *          return err(`someFunc: ${data.error}`)
 *      }
 *  }
 * ```
 *
 * However, the problem with this is that we might refactor `fn()` to return an error object instead:
 *
 * ```typescript
 *  function fn() {
 *      return failure({ error: 'http auth error', code: 401, endpoint: '/auth'  })
 *  }
 * ```
 *
 * Typescript won't complain about implicitly converting `data.error` into the infamous `[object Object]`
 *
 * ```typescript
 *  function someFunc() {
 *      let data = fn()
 *      if (isErr(data)) {
 *          // error will be string "someFunc: [object Object]", which we don't want
 *          return err(`someFunc: ${data.error}`)
 *      }
 *  }
 * ```
 *
 * In order to prevent this, wrap will ensure that the passed error is a string.
 */
export function wrap(context: string, err: Err<string>): Err<string> {
    return { isErr: true, error: `${context}: ${err.error}` }
}

// /**
//  * Returns an explicit error. The function overloads allows the producer to
//  * return string literal types, so that pattern matching errors is very simple
//  */
// export function failure<T extends string>(val: T): Err<T>
// export function failure<T extends object>(val: T): Err<T>
// export function failure<T>(val: T): Err<T> {
//     return { isErr: true, error: val }
// }

/**
 * Try to run a promise and return a Result.
 */
export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
    try {
        let result = await promise
        return ok(result)
    } catch (error) {
        // @ts-expect-error: if it has a `message` property it is quite probable
        // that it is an error
        if (error?.message) return { isErr: true, error: error.message }

        return { isErr: true, error: String(error) }
    }
}

/**
 * Unwraps a Result. Use this to throw an error, or for compatibility with other
 * libraries / frameworks that expect thrown exceptions.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (result.isErr) {
        if (typeof result.error === 'string') {
            throw new Error(result.error)
        }
        throw result.error
    }

    return result.val
}

class OctoError extends RequestError {
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

export function createActionCtx(publicContextUrl: string): ActionCtx {
    const client = new ConvexHttpClient(publicContextUrl)

    return {
        runQuery: async (query, ...args) => {
            // @ts-expect-error
            return await client.query(query, ...args)
        },
        runMutation: async (mutation, ...args) => {
            // @ts-expect-error
            return await client.mutation(mutation, ...args)
        },
        runAction: async (action, ...args) => {
            // @ts-expect-error
            return await client.action(action, ...args)
        },

        get auth(): any {
            throw new Error('not implemented')
        },

        scheduler: {
            runAfter: async (delay, action, ...args) => {
                let cancelId = setTimeout(() => {
                    // @ts-expect-error
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

import pino from 'pino'

export const logger = pino({
    level: env.DEV === 'true' ? 'debug' : 'info',
})

export function runProtectedQuery<Query extends FunctionReference<'query', 'public' | 'internal'>>(
    this: ActionCtx,
    query: Query,
    args: Omit<FunctionArgs<Query>, 'secret'>,
): Promise<FunctionReturnType<Query>> {
    // @ts-ignore
    return this.runQuery(query, { ...SECRET, ...args })
}
