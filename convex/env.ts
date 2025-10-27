import { z } from 'zod'

const boolFromString = z
    .string()
    .optional()
    .transform((s) => {
        if (!s) return false
        const v = s.trim().toLowerCase()
        return v === 'true'
    })
    .default(false)

const envSchema = z.object({
    DEV: boolFromString,
    DEBUG_LOGGER: boolFromString,
    CONVEX_SITE_URL: z.string().optional().default(''),
})

export const appEnv = envSchema.parse(process.env)
