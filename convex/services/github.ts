import { logger, parseDate } from '@convex/utils'
import { Octokit, RequestError } from 'octokit'
import { err, O, ok, tryCatch, wrap, type Err, type Result } from '../shared'

/**
 * Octokit for some reason accepts auth as any. This is bad, and I've been
 * bitten by this many times, so use this wrapper whenever creating newOctokits.
 */
export function newOctokit(tokenRow: { token: string }) {
    let octo = new Octokit({
        auth: tokenRow.token,
        throttle: { enabled: false },
    })
    return octo
}

export namespace Github {
    export type GitRefInfo = {
        name: string
        commitSha: string
        isTag: boolean
    }

    export async function getAllRefs(octo: Octokit, args: { owner: string; repo: string }) {
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

    export async function getUserAndTokenExpiration(token: { token: string }) {
        const octo = newOctokit(token)

        let res = await tryCatch(octo.rest.users.getAuthenticated())
        if (res.isErr) return wrap('failed to get token expiration', res)

        let expirationHeader = res.val.headers['github-authentication-token-expiration']
        if (expirationHeader === undefined || expirationHeader === '') {
            return err('no expiration header found in response')
        }

        let expiration
        if (typeof expirationHeader === 'string') {
            let parsed = parseDate(expirationHeader)
            if (parsed.isErr) return err('invalid expiration header')

            expiration = parsed.val
        } else if (typeof expirationHeader === 'number') {
            expiration = new Date(expirationHeader)
        } else {
            return err('invalid expiration header')
        }

        return ok({
            githubUser: {
                githubId: res.val.data.id,
                login: res.val.data.login,
                avatarUrl: res.val.data.avatar_url,
            },
            expiration,
        })
    }

    export async function getRateLimit(octo: Octokit) {
        let rateLimit = await octoCatchFull(octo.rest.rateLimit.get())
        if (rateLimit.isErr) {
            return octoWrap('failed to get rate limit', rateLimit)
        }

        let limit = rateLimit.val.headers['x-ratelimit-limit']
        let remaining = rateLimit.val.headers['x-ratelimit-remaining']
        let reset = rateLimit.val.headers['x-ratelimit-reset']

        return ok({ limit, remaining, reset })
    }

    export async function getRepoIssuePrCounts(
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

    export async function createIssue(
        octo: Octokit,
        args: { owner: string; repo: string; title: string; body: string },
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

    export async function addCommentToIssue(
        octo: Octokit,
        args: {
            owner: string
            repo: string
            issueNumber: number
            comment: string
        },
    ) {
        let added = await octoCatch(
            octo.rest.issues.createComment({
                owner: args.owner,
                repo: args.repo,
                issue_number: args.issueNumber,
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

    export async function getAuthenticatedUser(octo: Octokit): Promise<Result<AuthenticatedUser>> {
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

    type PollResult = {
        hasUpdates: boolean
        newEtag?: Etag
    }

    export async function checkForIssueUpdates(
        octo: Octokit,
        args: {
            owner: string
            repo: string
            since?: string
            etag?: Etag
        },
    ): R<PollResult> {
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
                    return ok({ hasUpdates: false })
                }
            }

            return err(octoCatch.errToString(res))
        }

        if (!res.val.headers.etag) return ok({ hasUpdates: true })
        let newEtag = res.val.headers.etag as Etag

        return ok({
            hasUpdates: res.val.data.length !== 0,
            newEtag,
        })
    }

    export async function editIssueTitle(
        octo: Octokit,
        args: {
            owner: string
            repo: string
            issueNumber: number
            title: string
        },
    ): R {
        let edited = await octoCatch(
            octo.rest.issues.update({
                owner: args.owner,
                repo: args.repo,
                issue_number: args.issueNumber,
                title: args.title,
            }),
        )
        if (edited.isErr) {
            return octoWrap(`Failed to edit issue title`, edited)
        }

        return ok()
    }

    const notificationReason = z.enum([
        'approval_requested',
        'assign',
        'author',
        'ci_activity',
        'comment',
        'invitation',
        'manual',
        'member_feature_requested',
        'mention',
        'review_requested',
        'security_advisory_credit',
        'security_alert',
        'state_change',
        'subscribed',
        'team_mention',
    ])

    export async function listNotifications(
        octo: Octokit,
        args: {
            page: number
            since?: string
        },
    ) {
        let page = await octoCatch(
            octo.rest.activity.listNotificationsForAuthenticatedUser({
                since: args?.since,
                all: true,
                per_page: 100,
                page: args.page,
            }),
        )
        if (page.isErr) return octoWrap('failed to fetch notifications page', page)

        let mapped: Notifications.UpsertBatchNotif[] = []
        for (let notif of page.val) {
            let resourceUrl = notif.subject.url
            let url = new URL(resourceUrl)
            let resourceNumber = url.pathname.split('/').pop()
            if (!resourceNumber) {
                logger.warn(`invalid resource url: ${url.pathname}`)
                continue
            }
            let resourceNumberInt = parseInt(resourceNumber)
            if (Number.isNaN(resourceNumberInt)) {
                logger.warn(`invalid resource number: ${resourceNumber}`)
                continue
            }

            let notifType: Doc<'notifications'>['type']
            if (
                notif.subject.type === 'Issue' ||
                notif.subject.type === 'PullRequest' ||
                notif.subject.type === 'Commit' ||
                notif.subject.type === 'Release'
            ) {
                notifType = notif.subject.type
            } else {
                logger.warn(`invalid subject type: ${notif.subject.type}`)
                continue
            }

            let reason = notificationReason.safeParse(notif.reason)
            if (!reason.success) {
                logger.warn(`invalid reason: ${notif.reason}`)
                continue
            }

            mapped.push({
                type: notifType,
                title: notif.subject.title,
                repo: {
                    owner: notif.repository.owner.login,
                    repo: notif.repository.name,
                    private: notif.repository.private,
                },
                githubId: notif.id,
                resourceNumber: resourceNumberInt,
                reason: reason.data,
                updatedAt: notif.updated_at,
                lastReadAt: notif.last_read_at ?? undefined,
                unread: notif.unread,
            })
        }

        return ok(mapped)
    }

    export async function listAllNotifications(
        octo: Octokit,
        args?: {
            since?: string
        },
    ) {
        // the 'if-modified-since' doesn't seem to work, so we can't use it to do
        // efficient polling.

        let pageNum = 0
        let allNotifs = []
        while (true) {
            let page = await listNotifications(octo, {
                page: pageNum,
                since: args?.since,
            })
            if (page.isErr) return wrap('failed to fetch notifications page', page)

            if (page.val.length === 0) {
                break
            }

            allNotifs.push(...page.val)
            pageNum++
        }

        return ok(allNotifs)
    }
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

export class OctoError extends RequestError {
    constructor(err: RequestError) {
        super(err.message, err.status, err)
    }

    error(): string {
        return `octo request error: (status: ${this.status}) ${this.message}`
    }
}

type OctoCatchErrors =
    | { type: 'octo-error'; err: OctoError }
    | { type: 'not-modified' }
    | { type: 'rate-limit-error'; err: OctoError; retryAfterSecs?: number }
    | { type: 'error'; err: string }

// best effort really
function tryErrToString(error: unknown): string {
    // @ts-expect-error: if it has a `message` property it is quite probable
    // that it is an error
    let msg: unknown = error?.message

    if (typeof msg === 'string') {
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
    } else if (error.err.type === 'rate-limit-error') {
        let errMsg = error.err.err.message
        if (error.err.retryAfterSecs !== undefined) {
            return `Rate limit exceeded: ${error.err.retryAfterSecs} seconds: ${errMsg}`
        }

        return `Rate limit exceeded: ${errMsg}`
    } else if (error.err.type === 'not-modified') {
        return 'Resource not modified'
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
            let rateLimitErr = isOctoRateLimitErr(error)
            if (rateLimitErr.isRateLimitErr) {
                return err({
                    type: 'rate-limit-error',
                    err: new OctoError(error),
                    retryAfterSecs: rateLimitErr.retryAfterSecs,
                })
            }

            if (error.response?.status === 304) {
                return err({ type: 'not-modified' })
            }

            return err({ type: 'octo-error', err: new OctoError(error) })
        }

        let msg = tryErrToString(error)

        return err({ type: 'error', err: msg })
    }
}

function isOctoRateLimitErr(
    error: RequestError,
): { isRateLimitErr: true; retryAfterSecs?: number } | { isRateLimitErr: false } {
    if (error.status === 403 || error.status === 429) {
        let retryAfterSecs: number | undefined
        let retryAfterHeader = error.request.headers['retry-after']
        if (typeof retryAfterHeader !== 'string') {
            retryAfterHeader = error.request.headers['Retry-After']
        }

        if (typeof retryAfterHeader === 'string') {
            if (typeof retryAfterHeader === 'string') {
                let parsed = parseInt(retryAfterHeader)
                if (!Number.isNaN(parsed)) {
                    retryAfterSecs = parsed
                }
            } else if (typeof retryAfterHeader === 'number') {
                retryAfterSecs = retryAfterHeader
            }

            return { isRateLimitErr: true, retryAfterSecs }
        }

        return { isRateLimitErr: true }
    }

    return { isRateLimitErr: false }
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

import { internal } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import type { Notifications } from '@convex/models/notifications'
import type { Etag } from '@convex/schema'
import { GraphqlResponseError } from '@octokit/graphql'
import z from 'zod'

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
            if (rateLimitErr.isSome) {
                return err({ type: 'rate-limit-error', err: rateLimitErr.val })
            }

            return err({ type: 'gql-error', err: error })
        }

        let msg = tryErrToString(error)
        return err({ type: 'error', err: msg })
    }
}

export function octoWrap(context: string, octoError: Err<OctoCatchErrors>): Err<string> {
    return err(`${context}: ${octoCatch.errToString(octoError)}`)
}

export type GraphqlRateLimitError = {
    retryAfterSecs: number
}

// default comes from recommended:
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#exceeding-the-rate-limit
let rateLimitErr: GraphqlRateLimitError = { retryAfterSecs: 60 }

function isGraphqlRateLimitError(err: GraphqlResponseError<unknown>): O<GraphqlRateLimitError> {
    let retryAfter = err.headers['retry-after']
    if (typeof retryAfter !== 'string') {
        retryAfter = err.headers['Retry-After']
    }

    const status = err.headers.status

    if (status === '403' || status === '429') {
        if (typeof retryAfter === 'string') {
            let retryAfterSecs = parseInt(retryAfter)
            if (Number.isNaN(retryAfterSecs)) {
                return O.some(rateLimitErr)
            }

            return O.some({ retryAfterSecs })
        }

        if (typeof retryAfter === 'number') {
            return O.some({ retryAfterSecs: retryAfter })
        }

        return O.none()
    }

    if (err.errors) {
        for (let error of err.errors) {
            if (error.type === 'RATE_LIMITED') {
                return O.some(rateLimitErr)
            }
            if (includesRateLimitMessage(error.message)) {
                return O.some(rateLimitErr)
            }
        }
    }

    return O.none()
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

export async function octoFromUserId(ctx: ActionCtx, userId: Id<'users'>) {
    let userToken = await ctx.runQuery(internal.models.pats.getByUserId, {
        userId,
    })
    if (!userToken) return err('user token not found')

    let octo = newOctokit(userToken)
    return ok(octo)
}
