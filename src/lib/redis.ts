import { appEnv } from '@/lib/app-env'
import { Redis } from '@upstash/redis'

const redisClient = new Redis({
    url: appEnv.UPSTASH_REDIS_REST_URL,
    token: appEnv.UPSTASH_REDIS_REST_TOKEN,
})

export async function redisGet<T = unknown>(key: string): Promise<T | null> {
    const start = performance.now()
    const result = await redisClient.get<T>(key)
    console.debug(`\x1b[90mredis.get(${key}): ${(performance.now() - start).toFixed(0)}ms\x1b[0m`)
    return result
}

export async function redisSet<T>(key: string, value: T, opts?: { ex: number }): Promise<void> {
    const start = performance.now()
    await redisClient.set(key, value, {
        ...opts,
        ex: 60 * 60 * 24,
    })
    console.debug(`\x1b[90mredis.set(${key}): ${(performance.now() - start).toFixed(0)}ms\x1b[0m`)
}
