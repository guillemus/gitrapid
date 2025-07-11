import { clerkMiddleware } from '@clerk/astro/server'

export const onRequest = clerkMiddleware({ secretKey: process.env.CLERK_SECRET_KEY })
