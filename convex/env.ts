import { PRIVATE_KEY } from './keys'

export const env = {
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID!,
    AUTH_GITHUB_PRIVATE_KEY: PRIVATE_KEY,
    AUTH_GITHUB_WEBHOOK_SECRET: process.env.AUTH_GITHUB_WEBHOOK_SECRET!,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN!,
    PUBLIC_CONVEX_URL: process.env.PUBLIC_CONVEX_URL!,
}
