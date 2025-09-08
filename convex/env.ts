import { z } from 'zod'

const boolFromString = z
    .string()
    .transform((s) => {
        const v = s.trim().toLowerCase()
        if (v === 'true') return true
        if (v === 'false') return false
        throw new z.ZodError([
            {
                code: 'invalid_value',
                message: 'Expected "true" or "false"',
                path: [],
                values: ['true', 'false'],
            },
        ])
    })
    .default(false)

const envSchema = z.object({
    DEV: boolFromString,
    DEBUG_LOGGER: boolFromString,
    AUTH_GITHUB_ID: z.string(),
    AUTH_GITHUB_WEBHOOK_SECRET: z.string(),
    CONVEX_SITE_URL: z.string(),
})

export const appEnv = envSchema.parse(process.env)
