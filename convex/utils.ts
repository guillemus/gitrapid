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

// fixme: this could be better modelled as a parse result of type 'head', type 'commit', etc
// so that there's no confusion

type RefAndPath = {
    ref: string
    path: string
    isCommit: boolean
}

const commitShaRegex = /^[a-f0-9]{40}$/i

export function parseRefAndPath(repoRefs: string[], refAndPath: string): RefAndPath | null {
    let repoRefsSet = new Set(repoRefs)

    let parts = refAndPath.split('/')
    let acc = ''
    let lastValidRef = ''

    if (refAndPath === '') {
        return {
            ref: 'HEAD',
            path: 'README.md',
            isCommit: false,
        }
    }

    let firstPart = parts[0]

    if (firstPart && commitShaRegex.test(firstPart)) {
        let path = parts.slice(1).join('/')
        if (path === '') {
            path = 'README.md'
        }

        return { ref: firstPart, path, isCommit: true }
    }

    for (let part of parts) {
        if (acc === '') {
            acc = part
        } else {
            acc = `${acc}/${part}`
        }

        if (repoRefsSet.has(acc)) {
            lastValidRef = acc
            continue
        }

        if (lastValidRef !== '') {
            let path = refAndPath.slice(lastValidRef.length)
            if (path.startsWith('/')) {
                path = path.slice(1)
            }
            return { ref: lastValidRef, path, isCommit: false }
        }
    }

    // Handle case where the entire string is a valid ref (no path)
    if (repoRefsSet.has(refAndPath)) {
        return { ref: refAndPath, path: 'README.md', isCommit: false }
    }

    return null
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

export async function getUserId(ctx: { auth: Auth }) {
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

export function err(msg: string): Failure<Error> {
    return { data: null, error: new Error(msg) }
}

export function failure<T>(val: T): Failure<T> {
    return { data: null, error: val }
}

export async function tryCatch<T, E = Error>(promise: Promise<T>): ResultP<T, E> {
    try {
        const data = await promise
        return { data, error: null }
    } catch (error) {
        return { data: null, error: error as E }
    }
}

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
        secret: process.env['AUTH_GITHUB_WEBHOOK_SECRET']!,
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
    if (args.secret !== process.env['AUTH_GITHUB_WEBHOOK_SECRET']) {
        throw new Error('Not available')
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
        get scheduler(): any {
            throw new Error('not implemented')
        },
        get storage(): any {
            throw new Error('not implemented')
        },
        get vectorSearch(): any {
            throw new Error('not implemented')
        },
    }
}

import {
    mutation as rawMutation,
    internalMutation as rawInternalMutation,
} from './_generated/server'
import type { DataModel, Id } from './_generated/dataModel'
import { Triggers } from 'convex-helpers/server/triggers'
import { customCtx, customMutation } from 'convex-helpers/server/customFunctions'

const triggers = new Triggers<DataModel>()

triggers.register('issues', async (ctx, change) => {
    async function getRepoCounts(repoId: Id<'repos'>) {
        let repo = await ctx.db.get(repoId)
        if (!repo) return

        let repoCounts = await ctx.db
            .query('repoCounts')
            .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
            .unique()
        return repoCounts
    }

    if (change.operation === 'delete') {
        let repoCounts = await getRepoCounts(change.oldDoc.repo)
        if (!repoCounts) return

        if (change.oldDoc.state === 'open') {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues - 1,
            })
        } else {
            await ctx.db.patch(repoCounts._id, {
                closedIssues: repoCounts.closedIssues - 1,
            })
        }
    } else if (change.operation === 'insert') {
        let repoCounts = await getRepoCounts(change.newDoc.repo)
        if (!repoCounts) return

        if (change.newDoc.state === 'open') {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues + 1,
            })
        } else {
            await ctx.db.patch(repoCounts._id, {
                closedIssues: repoCounts.closedIssues + 1,
            })
        }
    } else if (change.operation === 'update') {
        if (change.oldDoc.state === change.newDoc.state) {
            return
        }

        let repoCounts = await getRepoCounts(change.oldDoc.repo)
        if (!repoCounts) return

        if (change.newDoc.state === 'open') {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues + 1,
                closedIssues: repoCounts.closedIssues - 1,
            })
        } else {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues - 1,
                closedIssues: repoCounts.closedIssues + 1,
            })
        }
    }
})

// All mutations in this app should use these 2 to enforce triggers

export const appMutation = customMutation(rawMutation, customCtx(triggers.wrapDB))
export const appInternalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB))
