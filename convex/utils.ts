import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexHttpClient } from 'convex/browser'
import type {
    FunctionReference,
    FunctionReturnType,
    OptionalRestArgs,
    UserIdentity,
} from 'convex/server'
import { v } from 'convex/values'
import { RequestError } from 'octokit'
import type { ActionCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { env } from './env'
import { customMutation, customQuery } from 'convex-helpers/server/customFunctions'

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
                console.error(`BACKOFF: Operation failed after ${maxRetries} attempts:`, error)
                throw error
            }

            const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s, 8s
            console.log(`BACKOFF: Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error)
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }
    throw new Error('BACKOFF: Should not reach here')
}

type Auth = {
    getUserIdentity: () => Promise<UserIdentity | null>
}

export async function parseUserId(ctx: { auth: Auth }) {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
        throw new Error('User not authenticated')
    }

    return userId
}

export type Success<T> = {
    data: T
    error: null
}

export type Failure<E> = {
    data: null
    error: E
}

export type Result<T, E = Error> = Success<T> | Failure<E>
export type ResultP<T, E = Error> = Promise<Result<T, E>>

export function ok<T>(val: T): Success<T> {
    return { data: val, error: null }
}

/**
 * Convenient utility to create Failure.
 */
export function err(msg: string): Failure<Error> {
    return { data: null, error: new Error(msg) }
}

/**
 * Returns an explicit error. The function overloads allows the producer to
 * return const types, so that pattern matching errors is very simple
 */
export function failure<T extends string>(val: T): Failure<T>
export function failure<T extends object>(val: T): Failure<T>
export function failure<T>(val: T): Failure<T> {
    return { data: null, error: val }
}

/**
 * Wrap an error with additional context, similar to Go's fmt.Errorf("context: %w", err).
 * If the environment supports Error.cause, use it. Otherwise, attach as .cause.
 */
export function wrap(context: string, error: unknown): Failure<Error> {
    if (error instanceof Error) {
        // Use the ES2022 cause property if available
        try {
            // @ts-ignore
            return new Error(context, { cause: error })
        } catch {
            // Fallback for environments without Error.cause
            const wrapped = new Error(`${context}: ${error.message}`)
            // @ts-ignore
            wrapped.cause = error
            return failure(wrapped)
        }
    } else {
        // If err is not an Error, just stringify it
        return err(`${context}: ${String(err)}`)
    }
}

/**
 * Try to run a promise and return a Result.
 */
export async function tryCatch<T, E = Error>(promise: Promise<T>): ResultP<T, E> {
    try {
        const data = await promise
        return { data, error: null }
    } catch (error) {
        return { data: null, error: error as E }
    }
}

/**
 * Unwraps a Result. Use this to throw an error, or for compatibility with other
 * libraries / frameworks that expect thrown exceptions.
 */
export function unwrap<T, E>(res: Result<T, E>): T {
    if (res.error) {
        throw res.error
    }

    return res.data as T
}

export async function octoCatch<T>(promise: Promise<{ data: T }>): ResultP<T, RequestError> {
    try {
        let res = await promise
        return ok(res.data)
    } catch (error) {
        if (error instanceof RequestError) {
            return failure(error)
        }

        throw error
    }
}

export function addSecret<T extends object>(obj: T): T & { secret: string } {
    return {
        secret: env.AUTH_GITHUB_WEBHOOK_SECRET!,
        ...obj,
    } as T & { secret: string }
}

export function withSecret<T extends object>(obj: T) {
    return {
        secret: v.string(),
        ...obj,
    }
}

export function protectFn(args: { secret: string }) {
    if (args.secret !== env.AUTH_GITHUB_WEBHOOK_SECRET) {
        throw new Error('Not available') // security by obscurity
    }
}

export function actionHttpClient(client: ConvexHttpClient): ActionCtx {
    return {
        runQuery: async (query, ...args) => {
            // @ts-ignore
            return await client.query(query, ...args)
        },
        runMutation: async (mutation, ...args) => {
            // @ts-ignore
            return await client.mutation(mutation, ...args)
        },
        runAction: async (action, ...args) => {
            // @ts-ignore
            return await client.action(action, ...args)
        },

        get auth(): any {
            throw new Error('not implemented')
        },

        scheduler: {
            runAfter: async (delay, action, ...args) => {
                let cancelId = setTimeout(() => {
                    // @ts-ignore
                    client.action(action, ...args)
                }, delay)

                // We should not use this
                return cancelId as any
            },
            runAt: async (date, action, ...args) => {
                throw new Error('not implemented')
            },
            cancel: async (id) => {
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

export const protectedQuery = customQuery(query, {
    args: { secret: v.string() },
    async input(ctx, args) {
        protectFn(args)
        return { ctx: {}, args: {} }
    },
})

export const protectedMutation = customMutation(mutation, {
    args: { secret: v.string() },
    async input(ctx, args) {
        protectFn(args)
        return { ctx: {}, args: {} }
    },
})
