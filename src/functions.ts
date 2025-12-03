'use server'
import { redis } from '@/app/redis'
import { appEnv } from '@/lib/app-env'
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

export async function getPR(owner: string, repo: string, number: number) {
    const pullRequest = await cachedRequest(`pr:${owner}/${repo}/${number}`, (headers) =>
        octo.rest.pulls.get({
            owner,
            repo,
            pull_number: number,
            headers,
        }),
    )
    return pullRequest
}

export async function listPRs(owner: string, repo: string, page = 1) {
    if (page !== 1) {
        let res = await octo.rest.pulls.list({
            owner,
            repo,
            page: page ?? 1,
            per_page: 10,
        })

        return res.data
    }

    const pullRequests = await cachedRequest(`prs:${owner}/${repo}`, (headers) =>
        octo.rest.pulls.list({
            owner,
            repo,
            page,
            per_page: 10,
            headers,
        }),
    )

    return pullRequests
}

export async function getPRFiles(owner: string, repo: string, number: number) {
    const files = await cachedRequest(`pr-files:${owner}/${repo}/${number}`, (headers) =>
        octo.rest.pulls.listFiles({
            owner,
            repo,
            pull_number: number,
            headers,
        }),
    )
    return files
}

export async function listIssues(owner: string, repo: string) {
    const issues = await cachedRequest(`issues:${owner}/${repo}`, (headers) =>
        octo.rest.issues.listForRepo({
            owner,
            repo,
            headers,
        }),
    )

    return issues
}
