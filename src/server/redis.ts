import { appEnv } from '@/server/app-env'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redisClient = new Redis({
    url: appEnv.UPSTASH_REDIS_REST_URL,
    token: appEnv.UPSTASH_REDIS_REST_TOKEN,
})

const ratelimitAuth = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(200, '1 m'),
    prefix: 'ratelimit:auth',
    analytics: true,
})

const ratelimitAnon = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'ratelimit:anon',
    analytics: true,
})

export const checkRatelimitAnon = (identifier: string) => ratelimitAnon.limit(identifier)
export const checkRatelimitUser = (identifier: string) => ratelimitAuth.limit(identifier)

export async function redisGet<T = unknown>(key: string): Promise<T | null> {
    const start = performance.now()
    const result = await redisClient.get<T>(key)
    console.debug(`\x1b[90mredis.get(${key}): ${(performance.now() - start).toFixed(0)}ms\x1b[0m`)
    return result
}

export async function redisSet(key: string, value: unknown, opts?: { ex: number }): Promise<void> {
    const start = performance.now()
    await redisClient.set(key, value, {
        ...opts,
        // Keep 8h or less for caching potentially license-sensitive code
        ex: 60 * 60 * 8,
    })
    console.debug(`\x1b[90mredis.set(${key}): ${(performance.now() - start).toFixed(0)}ms\x1b[0m`)
}
