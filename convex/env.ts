export const env = {
    DEV: process.env.DEV!,
    DEBUG_LOGGER: !!process.env.DEBUG_LOGGER,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID!,
    AUTH_GITHUB_WEBHOOK_SECRET: process.env.AUTH_GITHUB_WEBHOOK_SECRET!,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN!,
    PUBLIC_CONVEX_URL: process.env.PUBLIC_CONVEX_URL!,
}
