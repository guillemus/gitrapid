import { z } from 'zod'

const boolFromString = z
    .string()
    .transform((s) => {
        const v = s.trim().toLowerCase()
        return v === 'true'
    })
    .default(false)

const envSchema = z.object({
    DEV: boolFromString,
    DEBUG_LOGGER: boolFromString,
    CONVEX_SITE_URL: z.string().optional().default(''),
    SECRET: z.string().optional(),
})

export const appEnv = envSchema.parse(process.env)
