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
import { Octokit } from '@octokit/rest'
import type { ActionCtx } from './_generated/server'
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

export type TreeFile = {
    path: string
    mode: string
    type: string
    sha: string
    size?: number
    url?: string
}

// The requirements are:
// - All files from a batch should not sum more than MAX_FILE_SIZE of size all together.
// - The batch should not have more than 10 files
export function batchTreeFiles(tree: TreeFile[]) {
    const batches: TreeFile[][] = []
    let currentBatch: TreeFile[] = []
    let currentBatchSize = 0

    for (const file of tree) {
        // Use file.size if present, otherwise treat as 0
        const fileSize = file.size ?? 0

        // If adding this file would exceed batch size or batch length, start a new batch
        if (
            currentBatch.length >= 10 ||
            (currentBatchSize + fileSize > MAX_FILE_SIZE && currentBatch.length > 0)
        ) {
            batches.push(currentBatch)
            currentBatch = []
            currentBatchSize = 0
        }

        // If the file itself is too big, put it in its own batch
        if (fileSize > MAX_FILE_SIZE) {
            batches.push([file])
            continue
        }

        currentBatch.push(file)
        currentBatchSize += fileSize
    }

    if (currentBatch.length > 0) {
        batches.push(currentBatch)
    }

    return batches
}

// max doc size should be less than 1mb, max doc size for convex
export const MAX_FILE_SIZE = 800 * 1024 // 800 KB in bytes

export async function validateRepo(octo: Octokit, args: { owner: string; repo: string }) {
    let repoSlug = `${args.owner}/${args.repo}`

    let repo
    repo = await octoCatch(octo.rest.repos.get(args))
    if (repo.error) {
        let isUnauthorized = repo.error.status === 401
        let badCredentials = repo.error.message.includes('Bad credentials')

        if (isUnauthorized && badCredentials) {
            return failure('bad-credentials')
        }

        return repo
    }

    console.log(`${repoSlug}: token is valid`)

    repo = repo.data

    // if repo is private the user has probably made a mistake. This is probably
    // not possible if we've done a good job with the PATs.

    if (repo.private) {
        return failure('private-repo')
    }

    console.log(`${repoSlug}: repo is public, checking license`)

    // check license, can we store the code?
    let license
    license = await octoCatch(octo.rest.licenses.getForRepo({ owner: args.owner, repo: args.repo }))
    if (license.error) {
        if (license.error.status === 404) {
            return failure('license-not-found')
        }

        return license
    }

    license = license.data

    let spdxId = license.license?.spdx_id
    if (!spdxId) {
        return failure('license-not-found')
    }
    if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
        return failure(
            new RepoError(
                spdxId,
                `Repo license ${spdxId} is not supported for public code download`,
            ),
        )
    }

    console.log(`${repoSlug}: license ${spdxId} is supported`)

    return ok(repo)
}

export class RepoError {
    constructor(
        public spdxId: string,
        public message: string,
    ) {}
}
