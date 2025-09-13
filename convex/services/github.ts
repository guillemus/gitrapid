import type { Id } from '@convex/_generated/dataModel'
import type { UpsertDoc } from '@convex/models/models'
import { parseDate } from '@convex/utils'
import { Octokit, RequestError } from 'octokit'
import { err, ok, tryCatch, wrap, type Err, type Result } from '../shared'

export const Github = {
    getAllRefs,
    getTokenExpiration,
    parseGithubUrl,
    getRateLimit,
    getRepoIssuePrCounts,
    createIssue,
    addComment,
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

// Octokit dependency
type OctoCfg = {
    octo: Octokit
}

export type GitRefInfo = {
    name: string
    commitSha: string
    isTag: boolean
}

async function getAllRefs(cfg: OctoCfg, args: { owner: string; repo: string }) {
    let heads = await octoCatch(cfg.octo.rest.git.listMatchingRefs({ ...args, ref: 'heads' }))
    if (heads.isErr) return octoWrap(`Failed to list heads refs`, heads)

    let tags = await octoCatch(cfg.octo.rest.git.listMatchingRefs({ ...args, ref: 'tags' }))
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

async function getRateLimit(cfg: OctoCfg) {
    let rateLimit = await octoCatchFull(cfg.octo.rest.rateLimit.get())
    if (rateLimit.isErr) {
        return octoWrap('failed to get rate limit', rateLimit)
    }

    let limit = rateLimit.val.headers['x-ratelimit-limit']
    let remaining = rateLimit.val.headers['x-ratelimit-remaining']
    let reset = rateLimit.val.headers['x-ratelimit-reset']

    return ok({ limit, remaining, reset })
}

async function getRepoIssuePrCounts(
    cfg: OctoCfg,
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
        cfg.octo.graphql<GraphQLResponse>(query, { owner: args.owner, name: args.repo }),
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
    cfg: OctoCfg,
    args: { owner: string; repo: string; title: string; body: string; repoId: Id<'repos'> },
): R<UpsertDoc<'issues'>> {
    let created = await octoCatch(
        cfg.octo.rest.issues.create({
            owner: args.owner,
            repo: args.repo,
            title: args.title,
            body: args.body,
        }),
    )
    if (created.isErr) {
        return octoWrap(`Failed to create issue`, created)
    }

    let gh = created.val

    let labels: string[] = []
    if (Array.isArray(gh.labels)) {
        for (let l of gh.labels) {
            if (typeof l === 'string') {
                labels.push(l)
            } else if (l.name) {
                labels.push(l.name)
            }
        }
    }

    let assignees: string[] = []
    if (Array.isArray(gh.assignees)) {
        for (let a of gh.assignees) {
            if (typeof a === 'string') {
                assignees.push(a)
            } else if (a.login) {
                assignees.push(a.login)
            }
        }
    }

    let state: 'open' | 'closed' = gh.state === 'closed' ? 'closed' : 'open'

    let issueDoc: UpsertDoc<'issues'> = {
        repoId: args.repoId,
        githubId: gh.id ?? 0,
        number: gh.number,
        title: gh.title ?? args.title,
        state,
        author: { login: gh.user?.login ?? '', id: gh.user?.id ?? 0 },
        labels: labels.length ? labels : undefined,
        assignees: assignees.length ? assignees : undefined,
        createdAt: gh.created_at ?? new Date().toISOString(),
        updatedAt: gh.updated_at ?? new Date().toISOString(),
        closedAt: gh.closed_at ?? undefined,
        comments: typeof gh.comments === 'number' ? gh.comments : undefined,
    }

    return ok(issueDoc)
}

async function addComment(
    cfg: OctoCfg,
    args: {
        owner: string
        repo: string
        number: number
        comment: string
        repoId: Id<'repos'>
        issueId: Id<'issues'>
    },
): R<UpsertDoc<'issueComments'>> {
    let added = await octoCatch(
        cfg.octo.rest.issues.createComment({
            owner: args.owner,
            repo: args.repo,
            issue_number: args.number,
            body: args.comment,
        }),
    )
    if (added.isErr) {
        return octoWrap(`Failed to add comment`, added)
    }

    let doc: UpsertDoc<'issueComments'> = {
        issueId: args.issueId,
        repoId: args.repoId,
        githubId: added.val.id,
        author: { login: added.val.user?.login ?? '', id: added.val.user?.id ?? 0 },
        body: added.val.body ?? '',
        createdAt: added.val.created_at ?? new Date().toISOString(),
        updatedAt: added.val.updated_at ?? new Date().toISOString(),
    }

    return ok(doc)
}

export type AuthenticatedUser = {
    id: number
    login: string
    name: string | null
    avatarUrl: string
}

async function getAuthenticatedUser(cfg: OctoCfg): Promise<Result<AuthenticatedUser>> {
    let res = await tryCatch(cfg.octo.rest.users.getAuthenticated())
    if (res.isErr) return wrap('failed to get authenticated user', res)

    let user = res.val.data
    return ok({
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
    })
}

export type IssueUpdateCheck = {
    hasUpdates: boolean
    newEtag: string
}

async function checkForIssueUpdates(
    cfg: OctoCfg,
    args: {
        owner: string
        repo: string
        etag?: string
    },
): R<IssueUpdateCheck> {
    let headers: Record<string, string> = {}
    if (args.etag) {
        headers['If-None-Match'] = args.etag
    }

    let res = await octoCatchFull(
        cfg.octo.rest.issues.listForRepo({
            owner: args.owner,
            repo: args.repo,
            state: 'all',
            sort: 'updated',
            direction: 'desc',
            per_page: 1,
            headers,
        }),
    )
    if (res.isErr) return err(octoCatch.errToString(res))

    let newEtag = res.val.headers.etag
    if (!newEtag) return err('no etag found in response')

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

export async function octoCatchFull<T>(promise: Promise<T>): Promise<Result<T, OctoCatchErrors>> {
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

type OctoCatchGqlErrors =
    | { type: 'gql-error'; err: GraphqlResponseError<unknown> }
    | { type: 'error'; err: string }

export async function octoCatchGql<T>(promise: Promise<T>): Promise<Result<T, OctoCatchGqlErrors>> {
    try {
        let res = await promise
        return ok(res)
    } catch (error) {
        if (error instanceof GraphqlResponseError) {
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

type GraphqlRateLimitError = {
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
