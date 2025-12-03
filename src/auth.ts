import { appEnv } from '@/lib/app-env'
import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

export const auth = betterAuth({
    database: new Pool({
        connectionString: appEnv.DATABASE_URL,
    }),

    socialProviders: {
        github: {
            clientId: appEnv.GITHUB_CLIENT_ID,
            clientSecret: appEnv.GITHUB_CLIENT_SECRET,
        },
    },
})
