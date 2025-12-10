import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redisGet, redisSet } from '@/lib/redis'
import { getRequest } from '@tanstack/react-start/server'
import { Octokit } from 'octokit'

const ETAG_CACHING = true

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

type User = {
    userId: string
    token: string
}

export const ERR_UNAUTHORIZED = 'error_unauthorized'
export const ERR_NO_SUBSCRIPTION_FOUND = 'error_no_subscription_found'

export async function assertUser(): Promise<User> {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
        throw new Error(ERR_UNAUTHORIZED)
    }

    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: 'github',
        },
    })

    if (!account?.accessToken) {
        throw new Error(ERR_UNAUTHORIZED)
    }

    const subscription = await prisma.subscription.findUnique({
        where: { userId: session.user.id },
    })

    // Check if subscription exists and is active or trialing
    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
        throw new Error(ERR_NO_SUBSCRIPTION_FOUND)
    }

    return { userId: session.user.id, token: account.accessToken }
}

export function newOcto(token: string) {
    return new Octokit({ auth: token })
}

function isErrEtagCached(error: unknown) {
    return error instanceof Error && 'status' in error && error.status === 304
}

// Note: for paging requests, use cachedRequest only for the first page. If page 1 changes, all subsequent pages
// are likely invalid due to shifted offsets. Uncached pages stay consistent with current state.
export async function cachedRequest<T>(
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
