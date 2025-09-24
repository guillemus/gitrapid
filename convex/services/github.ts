import type { Id } from '@convex/_generated/dataModel'
import { parseDate } from '@convex/utils'
import { Octokit, RequestError } from 'octokit'
import { err, ok, tryCatch, wrap, type Err, type Result } from '../shared'

export const Github = {
    getAllRefs,
    getTokenExpiration,
    parseGithubUrl,
    getRateLimit,
    getRepoIssuePrCounts,
    createIssue: createIssue,
    addComment: addComment,
    getAuthenticatedUser,
    checkForIssueUpdates,
}

/**
 * Octokit for some reason accepts auth as any. This is bad, and I've been
 * bitten by this many times, so use this wrapper whenever creating newOctokits.
 */
export function newOctokit(token: string) {
    let octo = new Octokit({
        auth: token,
        throttle: { enabled: false },
    })
    return octo
}

export type GitRefInfo = {
    name: string
    commitSha: string
    isTag: boolean
}

async function getAllRefs(octo: Octokit, args: { owner: string; repo: string }) {
    let heads = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'heads' }))
    if (heads.isErr) return octoWrap(`Failed to list heads refs`, heads)

    let tags = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'tags' }))
    if (tags.isErr) return octoWrap(`Failed to list tags refs`, tags)

    let data: GitRefInfo[] = [
        ...heads.val.map((ref) => ({
            name: ref.ref.replace('refs/heads/', ''),
            commitSha: ref.object.sha,
            isTag: false,
        })),
        ...tags.val.map((ref) => ({
            name: ref.ref.replace('refs/tags/', ''),
            commitSha: ref.object.sha,
            isTag: true,
        })),
    ]

    return ok(data)
}

async function getTokenExpiration(token: string): R<Date> {
    const octo = newOctokit(token)

    let res = await tryCatch(octo.rest.users.getAuthenticated())
    if (res.isErr) return wrap('failed to get token expiration', res)

    let expiration = res.val.headers['github-authentication-token-expiration']
    if (!expiration) {
        return err('no expiration header found in response')
    }

    if (typeof expiration === 'string') {
        return parseDate(expiration)
    } else if (typeof expiration === 'number') {
        return ok(new Date(expiration))
    }

    return err('invalid expiration header')
}

export function parseGithubUrl(raw: string): Result<{ owner: string; repo: string }> {
    // Handle URLs that start with github.com without protocol
    let urlString = raw
    if (!raw.includes('://') && raw.startsWith('github.com')) {
        urlString = 'https://' + raw
    }

    let url: URL
    try {
        url = new URL(urlString)
    } catch {
        return err('invalid github url')
    }

    if (url.hostname !== 'github.com') return err('invalid github url')

    let parts = url.pathname.split('/')
    if (parts.length < 3) return err('invalid github url')

    let owner = parts[1]
    let repo = parts[2]

    if (!owner || !repo) return err('invalid github url')

    return ok({ owner, repo })
}

async function getRateLimit(octo: Octokit) {
    let rateLimit = await octoCatchFull(octo.rest.rateLimit.get())
    if (rateLimit.isErr) {
        return octoWrap('failed to get rate limit', rateLimit)
    }

    let limit = rateLimit.val.headers['x-ratelimit-limit']
    let remaining = rateLimit.val.headers['x-ratelimit-remaining']
    let reset = rateLimit.val.headers['x-ratelimit-reset']

    return ok({ limit, remaining, reset })
}

async function getRepoIssuePrCounts(
    octo: Octokit,
    args: { owner: string; repo: string },
): R<{
    openIssues: number
    closedIssues: number
    totalIssues: number
    openPullRequests: number
    closedPullRequests: number
    totalPullRequests: number
}> {
    let query = `
        query RepoCounts($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            issuesOpen: issues(states: OPEN) { totalCount }
            issuesClosed: issues(states: CLOSED) { totalCount }
            prsOpen: pullRequests(states: OPEN) { totalCount }
            prsClosed: pullRequests(states: CLOSED) { totalCount }
          }
        }
    `

    type GraphQLResponse = {
        repository: {
            issuesOpen: { totalCount: number }
            issuesClosed: { totalCount: number }
            prsOpen: { totalCount: number }
            prsClosed: { totalCount: number }
        }
    }

    let res = await tryCatch(
        octo.graphql<GraphQLResponse>(query, { owner: args.owner, name: args.repo }),
    )
    if (res.isErr) return wrap('failed to fetch repository issue/PR counts', res)

    let repo = res.val.repository
    let openIssues = repo.issuesOpen.totalCount
    let closedIssues = repo.issuesClosed.totalCount
    let totalIssues = openIssues + closedIssues
    let openPullRequests = repo.prsOpen.totalCount
    let closedPullRequests = repo.prsClosed.totalCount
    let totalPullRequests = openPullRequests + closedPullRequests

    return ok({
        openIssues,
        closedIssues,
        totalIssues,
        openPullRequests,
        closedPullRequests,
        totalPullRequests,
    })
}

async function createIssue(
    octo: Octokit,
    args: { owner: string; repo: string; title: string; body: string; repoId: Id<'repos'> },
) {
    let created = await octoCatch(
        octo.rest.issues.create({
            owner: args.owner,
            repo: args.repo,
            title: args.title,
            body: args.body,
        }),
    )
    if (created.isErr) {
        return octoWrap(`Failed to create issue`, created)
    }

    return created
}

async function addComment(
    octo: Octokit,
    args: {
        owner: string
        repo: string
        number: number
        comment: string
    },
) {
    let added = await octoCatch(
        octo.rest.issues.createComment({
            owner: args.owner,
            repo: args.repo,
            issue_number: args.number,
            body: args.comment,
        }),
    )
    if (added.isErr) {
        return octoWrap(`Failed to add comment`, added)
    }

    return added
}

export type AuthenticatedUser = {
    id: number
    login: string
    name: string | null
    avatarUrl: string
}

async function getAuthenticatedUser(octo: Octokit): Promise<Result<AuthenticatedUser>> {
    let res = await tryCatch(octo.rest.users.getAuthenticated())
    if (res.isErr) return wrap('failed to get authenticated user', res)

    let user = res.val.data
    return ok({
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
    })
}

async function checkForIssueUpdates(
    octo: Octokit,
    args: {
        owner: string
        repo: string
        since?: string
        etag?: string
    },
): R<{ hasUpdates: boolean; newEtag?: string }> {
    let headers: Record<string, string> = {}
    if (args.etag) {
        headers['If-None-Match'] = args.etag
    }

    let res = await octoCatchFull(
        octo.rest.issues.listForRepo({
            owner: args.owner,
            repo: args.repo,
            since: args.since,
            state: 'all',
            sort: 'updated',
            direction: 'desc',
            per_page: 1,
            headers,
        }),
    )
    if (res.isErr) {
        if (res.err.type === 'octo-error') {
            if (res.err.err.response?.status === 304) {
                return ok({
                    hasUpdates: false,
                    newEtag: args.etag,
                })
            }
        }

        return err(octoCatch.errToString(res))
    }

    let newEtag = res.val.headers.etag
    if (!newEtag) return ok({ hasUpdates: true })

    return ok({
        hasUpdates: true,
        newEtag,
    })
}

export class OctoError extends RequestError {
    constructor(err: RequestError) {
        super(err.message, err.status, err)
    }

    error(): string {
        return `octo request error: (status: ${this.status}) ${this.message}`
    }
}

type OctoCatchErrors = { type: 'octo-error'; err: OctoError } | { type: 'error'; err: string }

// best effort really
function tryErrToString(error: unknown): string {
    // @ts-expect-error: if it has a `message` property it is quite probable
    // that it is an error
    let msg: unknown = error?.message

    if (msg && typeof msg === 'string') {
        return msg
    }
    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

octoCatch.errToString = function (error: Err<OctoCatchErrors>): string {
    if (error.err.type === 'octo-error') {
        return error.err.err.error()
    }

    return error.err.err
}

octoCatch.gqlErrToString = function (error: Err<OctoCatchGqlErrors>): string {
    if (error.err.type === 'gql-error') {
        return error.err.err.message
    }

    if (error.err.type === 'rate-limit-error') {
        return `Rate limit exceeded: ${error.err.err.retryAfterSecs} seconds`
    }

    return error.err.err
}

export async function octoCatch<T>(
    promise: Promise<{ data: T }>,
): Promise<Result<T, OctoCatchErrors>> {
    try {
        let res = await promise
        return ok(res.data)
    } catch (error) {
        if (error instanceof RequestError) {
            return err({ type: 'octo-error', err: new OctoError(error) })
        }

        let msg = tryErrToString(error)

        return err({ type: 'error', err: msg })
    }
}

export async function octoCatchFull<T>(promise: Promise<T>): R<T, OctoCatchErrors> {
    try {
        let res = await promise
        return ok(res)
    } catch (error) {
        if (error instanceof RequestError) {
            return err({ type: 'octo-error', err: new OctoError(error) })
        }

        let msg = tryErrToString(error)

        return err({ type: 'error', err: msg })
    }
}

import { GraphqlResponseError } from '@octokit/graphql'

export type OctoCatchGqlErrors =
    | { type: 'gql-error'; err: GraphqlResponseError<unknown> }
    | { type: 'rate-limit-error'; err: GraphqlRateLimitError }
    | { type: 'error'; err: string }

export async function octoCatchGql<T>(promise: Promise<T>): R<T, OctoCatchGqlErrors> {
    try {
        let res = await promise
        return ok(res)
    } catch (error) {
        if (error instanceof GraphqlResponseError) {
            let rateLimitErr = isGraphqlRateLimitError(error)
            if (rateLimitErr) {
                return err({ type: 'rate-limit-error', err: rateLimitErr })
            }

            return err({ type: 'gql-error', err: error })
        }

        let msg = tryErrToString(error)
        return err({ type: 'error', err: msg })
    }
}

export function octoWrap(context: string, octoError: Err<OctoCatchErrors>): Err<string> {
    if (octoError.err.type === 'octo-error') {
        return err(`${context}: ${octoError.err.err.error()}`)
    }

    let msg: string = octoError.err.err
    return err(`${context}: ${msg}`)
}

export type GraphqlRateLimitError = {
    retryAfterSecs: number
}

// default comes from recommended:
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#exceeding-the-rate-limit
let rateLimitErr: GraphqlRateLimitError = { retryAfterSecs: 60 }

export function isGraphqlRateLimitError(
    err: GraphqlResponseError<unknown>,
): false | GraphqlRateLimitError {
    const retryAfter = err.headers['retry-after']
    const status = err.headers.status

    if (status === '403' || status === '429') {
        if (retryAfter) {
            if (typeof retryAfter === 'string') {
                let retryAfterSecs = parseInt(retryAfter)
                if (Number.isNaN(retryAfterSecs)) {
                    return rateLimitErr
                }

                return { retryAfterSecs }
            }

            if (typeof retryAfter === 'number') {
                return { retryAfterSecs: retryAfter }
            }
        }

        return rateLimitErr
    }

    if (err.errors) {
        for (let error of err.errors) {
            if (error.type === 'RATE_LIMITED') {
                return rateLimitErr
            }
            if (includesRateLimitMessage(error.message)) {
                return rateLimitErr
            }
        }
    }

    return false
}

function includesRateLimitMessage(message: string): boolean {
    if (!message) return false
    const lower = message.toLowerCase()
    return (
        lower.includes('rate limit exceeded') ||
        lower.includes('secondary rate limit') ||
        lower.includes('abuse detection') ||
        lower.includes('retry later') ||
        lower.includes('retry-after')
    )
}
