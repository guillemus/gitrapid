import { clerkMiddleware } from '@clerk/astro/server'

export const onRequest = clerkMiddleware({ secretKey: import.meta.env.CLERK_SECRET_KEY })
