import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redisGet, redisSet } from '@/lib/redis'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { Octokit } from 'octokit'
import { z } from 'zod'

const ETAG_CACHING = true

export const UNAUTHORIZED_ERROR = 'unauthorized'

async function timedRequest<T>(
    cacheKey: string,
    request: (headers: {
        'If-None-Match'?: string
    }) => Promise<{ data: T; headers: { etag?: string } }>,
    headers: { 'If-None-Match'?: string },
): Promise<{ data: T; headers: { etag?: string } }> {
    const start = performance.now()
    try {
        const response = await request(headers)
        console.log(
            `\x1b[33m${cacheKey}: ${(performance.now() - start).toFixed(0)}ms\x1b[0m \x1b[31m(not cached)\x1b[0m`,
        )
        return response
    } catch (error) {
        if (isErrEtagCached(error)) {
            console.log(
                `\x1b[33m${cacheKey}: ${(performance.now() - start).toFixed(0)}ms\x1b[0m \x1b[32m(etag cached)\x1b[0m`,
            )
        } else {
            console.log(
                `\x1b[33m${cacheKey}: ${(performance.now() - start).toFixed(0)}ms\x1b[0m \x1b[31m(error)\x1b[0m`,
            )
        }
        throw error
    }
}

async function assertUserToken() {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
        throw new Error(UNAUTHORIZED_ERROR)
    }

    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: 'github',
        },
    })

    if (!account?.accessToken) {
        throw new Error(UNAUTHORIZED_ERROR)
    }

    return { userId: session.user.id, token: account.accessToken }
}

function newOcto(token: string) {
    return new Octokit({ auth: token })
}

function isErrEtagCached(error: unknown) {
    return error instanceof Error && 'status' in error && error.status === 304
}

// Note: for paging requests, use cachedRequest only for the first page. If page 1 changes, all subsequent pages
// are likely invalid due to shifted offsets. Uncached pages stay consistent with current state.
async function cachedRequest<T>(
    userId: string,
    cacheKey: string,
    request: (headers: {
        'If-None-Match'?: string
    }) => Promise<{ data: T; headers: { etag?: string } }>,
): Promise<T> {
    const dataKey = `data:${cacheKey}`
    const etagKey = `etag:${userId}:${cacheKey}`

    if (!ETAG_CACHING) {
        const response = await timedRequest(cacheKey, request, {})
        return response.data
    }

    const [cachedData, userEtag] = await Promise.all([redisGet(dataKey), redisGet<string>(etagKey)])

    const headers = typeof userEtag === 'string' ? { 'If-None-Match': userEtag } : {}

    try {
        const response = await timedRequest(cacheKey, request, headers)

        if (response.headers.etag) {
            await Promise.all([
                redisSet(dataKey, response.data),
                redisSet(etagKey, response.headers.etag),
            ])
        }

        return response.data
    } catch (error: unknown) {
        if (cachedData && isErrEtagCached(error)) {
            console.debug('\x1b[36mreturning cached response\x1b[0m')
            return cachedData as T
        }
        throw error
    }
}

export const getPR = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .handler(async ({ data }) => {
        let userToken = await assertUserToken()
        let octo = newOcto(userToken.token)

        const pullRequest = await cachedRequest(
            userToken.userId,
            `pr:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.pulls.get({
                    owner: data.owner,
                    repo: data.repo,
                    pull_number: data.number,
                    headers,
                }),
        )
        return pullRequest
    })

export const listPRs = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string(), page: z.number().optional() }))
    .handler(async ({ data }) => {
        let userToken = await assertUserToken()
        let octo = newOcto(userToken.token)

        const page = data.page ?? 1
        if (page !== 1) {
            let res = await octo.rest.pulls.list({
                owner: data.owner,
                repo: data.repo,
                page,
                per_page: 10,
            })

            return res.data
        }

        const pullRequests = await cachedRequest(
            userToken.userId,
            `prs:${data.owner}/${data.repo}`,
            (headers) =>
                octo.rest.pulls.list({
                    owner: data.owner,
                    repo: data.repo,
                    page,
                    per_page: 10,
                    headers,
                }),
        )

        return pullRequests
    })

export const getPRFiles = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .handler(async ({ data }) => {
        let userToken = await assertUserToken()
        let octo = newOcto(userToken.token)

        const files = await cachedRequest(
            userToken.userId,
            `pr-files:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.pulls.listFiles({
                    owner: data.owner,
                    repo: data.repo,
                    pull_number: data.number,
                    headers,
                }),
        )
        return files
    })

export const listIssues = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string() }))
    .handler(async ({ data }) => {
        let userToken = await assertUserToken()
        let octo = newOcto(userToken.token)

        const issues = await cachedRequest(
            userToken.userId,
            `issues:${data.owner}/${data.repo}`,
            (headers) =>
                octo.rest.issues.listForRepo({
                    owner: data.owner,
                    repo: data.repo,
                    headers,
                }),
        )

        return issues
    })

export const getPRComments = createServerFn({ method: 'GET' })
    .inputValidator(
        z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            page: z.number().optional(),
        }),
    )
    .handler(async ({ data }) => {
        let userToken = await assertUserToken()
        let octo = newOcto(userToken.token)

        const page = data.page ?? 1
        if (page !== 1) {
            let res = await octo.rest.issues.listComments({
                owner: data.owner,
                repo: data.repo,
                issue_number: data.number,
                per_page: 30,
                page,
            })

            return res.data
        }

        const comments = await cachedRequest(
            userToken.userId,
            `pr-comments:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.issues.listComments({
                    owner: data.owner,
                    repo: data.repo,
                    issue_number: data.number,
                    per_page: 30,
                    page,
                    headers,
                }),
        )
        return comments
    })

export const getPRReviewComments = createServerFn({ method: 'GET' })
    .inputValidator(
        z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            page: z.number().optional(),
        }),
    )
    .handler(async ({ data }) => {
        let userToken = await assertUserToken()
        let octo = newOcto(userToken.token)

        const page = data.page ?? 1
        if (page !== 1) {
            let res = await octo.rest.pulls.listReviewComments({
                owner: data.owner,
                repo: data.repo,
                pull_number: data.number,
                per_page: 30,
                page,
            })

            return res.data
        }

        const comments = await cachedRequest(
            userToken.userId,
            `pr-review-comments:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.pulls.listReviewComments({
                    owner: data.owner,
                    repo: data.repo,
                    pull_number: data.number,
                    per_page: 30,
                    page,
                    headers,
                }),
        )
        return comments
    })
