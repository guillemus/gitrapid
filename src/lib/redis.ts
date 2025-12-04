import { appEnv } from '@/lib/app-env'
import { Redis } from '@upstash/redis'

export const redis = new Redis({
    url: appEnv.UPSTASH_REDIS_REST_URL,
    token: appEnv.UPSTASH_REDIS_REST_TOKEN,
})
