import { z } from 'zod'

const boolFromString = z
    .string()
    .transform((s) => {
        const v = s.trim().toLowerCase()
        if (v === 'true') return true
        if (v === 'false') return false

        return false
    })
    .default(false)

const envSchema = z.object({
    DEV: boolFromString,
    DEBUG_LOGGER: boolFromString,
    CONVEX_SITE_URL: z.string().optional().default(''),
    SECRET: z.string(),
})

export const appEnv = envSchema.parse(process.env)
