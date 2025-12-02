'use server'
import { Octokit } from 'octokit'
import { redis } from './redis'

let octo = new Octokit({ auth: process.env.GITHUB_TOKEN })

type CacheEntry<T> = {
    etag: string
    data: T
}

async function cachedRequest<T>(
    cacheKey: string,
    request: (headers: {
        'If-None-Match'?: string
    }) => Promise<{ data: T; headers: { etag?: string } }>,
): Promise<T> {
    let start = performance.now()
    console.log(`redis.get: ${performance.now() - start}ms`)
    const cached = await redis.get<CacheEntry<T>>(cacheKey)

    const headers: { 'If-None-Match'?: string } = {}
    if (cached) {
        headers['If-None-Match'] = cached.etag
    }

    try {
        const response = await request(headers)
        const etag = response.headers.etag
        if (etag) {
            let start = performance.now()
            await redis.set(cacheKey, { etag, data: response.data } satisfies CacheEntry<T>)
            console.log(`redis.set: ${performance.now() - start}ms`)
        }
        return response.data
    } catch (error: unknown) {
        if (cached && error instanceof Error && 'status' in error && error.status === 304) {
            return cached.data
        }
        throw error
    }
}

export async function getPR(owner: string, repo: string, number: number) {
    let start = performance.now()
    const pullRequest = await cachedRequest(`pr:${owner}/${repo}/${number}`, (headers) =>
        octo.rest.pulls.get({
            owner,
            repo,
            pull_number: number,
            headers,
        }),
    )
    console.log(`getPR: ${performance.now() - start}ms`)
    return pullRequest
}

export async function listPRs(owner: string, repo: string) {
    let start = performance.now()
    const pullRequests = await cachedRequest(`prs:${owner}/${repo}`, (headers) =>
        octo.rest.pulls.list({
            owner,
            repo,
            per_page: 5,
            headers,
        }),
    )
    console.log(`listPRs: ${performance.now() - start}ms`)

    return pullRequests
}

export async function getPRFiles(owner: string, repo: string, number: number) {
    let start = performance.now()
    const files = await cachedRequest(`pr-files:${owner}/${repo}/${number}`, (headers) =>
        octo.rest.pulls.listFiles({
            owner,
            repo,
            pull_number: number,
            headers,
        }),
    )
    console.log(`getPRFiles: ${performance.now() - start}ms`)
    return files
}
