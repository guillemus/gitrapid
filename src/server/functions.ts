import { redis } from '@/lib/redis'
import { appEnv } from '@/lib/app-env'
import { createServerFn } from '@tanstack/react-start'
import { Octokit } from 'octokit'
import { z } from 'zod'

let octo = new Octokit({ auth: appEnv.GITHUB_TOKEN })

const cacheEntrySchema = z
    .object({
        etag: z.string(),
        data: z.unknown(),
    })
    .nullish()

let etagCaching = true
let etagCachedMsg = true

// Only cache page 1 for list requests. If page 1 changes, all subsequent pages
// are likely invalid due to shifted offsets. Uncached pages stay consistent with current state.
async function cachedRequest<T>(
    cacheKey: string,
    request: (headers: {
        'If-None-Match'?: string
    }) => Promise<{ data: T; headers: { etag?: string } }>,
): Promise<T> {
    if (!etagCaching) {
        let requestStart = performance.now()
        const response = await request({})
        console.log(`${cacheKey}: ${performance.now() - requestStart}ms`)

        return response.data
    }

    let start = performance.now()
    console.debug(`redis.get: ${performance.now() - start}ms`)
    let cached
    cached = await redis.get(cacheKey)
    cached = cacheEntrySchema.parse(cached)

    const headers: { 'If-None-Match'?: string } = {}
    if (cached) {
        headers['If-None-Match'] = cached.etag
    }

    let requestStart = performance.now()
    try {
        const response = await request(headers)

        const etag = response.headers.etag
        if (etag) {
            let start = performance.now()
            await redis.set(cacheKey, { etag, data: response.data }, { ex: 60 * 60 * 24 })
            console.debug(`redis.set: ${performance.now() - start}ms`)
        }

        return response.data
    } catch (error: unknown) {
        if (cached && error instanceof Error && 'status' in error && error.status === 304) {
            if (etagCachedMsg) {
                console.debug('returning cached response')
            }

            return cached.data as T
        }
        throw error
    } finally {
        console.log(`${cacheKey}: ${performance.now() - requestStart}ms`)
    }
}

export const getPR = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .handler(async ({ data }) => {
        const pullRequest = await cachedRequest(
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

        const pullRequests = await cachedRequest(`prs:${data.owner}/${data.repo}`, (headers) =>
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
        const files = await cachedRequest(
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
        const issues = await cachedRequest(`issues:${data.owner}/${data.repo}`, (headers) =>
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
