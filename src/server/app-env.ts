import 'dotenv/config'
import { z } from 'zod'

export const appEnv = z
    .object({
        DATABASE_URL: z.string(),
        GITHUB_CLIENT_ID: z.string(),
        GITHUB_CLIENT_SECRET: z.string(),

        UPSTASH_REDIS_REST_URL: z.string(),
        UPSTASH_REDIS_REST_TOKEN: z.string(),

        POLAR_TOKEN: z.string(),
        POLAR_SERVER: z.union([z.literal('sandbox'), z.literal('production')]),
        POLAR_WEBHOOK_SECRET: z.string(),
        POLAR_PRODUCT_MONTHLY_ID: z.string(),

        GITHUB_TOKEN: z.string(),
    })
    .parse(process.env)
