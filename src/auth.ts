import { polar, syncSubscriptionByPolarCustomerId } from '@/polar'
import { appEnv } from '@/server/app-env'
import { checkout, polar as polarPlugin, portal, webhooks } from '@polar-sh/better-auth'
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

    plugins: [
        polarPlugin({
            client: polar,
            createCustomerOnSignUp: true,
            use: [
                checkout({
                    products: [{ productId: appEnv.POLAR_PRODUCT_MONTHLY_ID, slug: 'monthly' }],
                    successUrl: '/success?checkout_id={CHECKOUT_ID}',
                    authenticatedUsersOnly: true,
                }),
                portal(),
                // full path is https://<domain>/api/auth/polar/webhooks
                webhooks({
                    secret: appEnv.POLAR_WEBHOOK_SECRET,
                    onCustomerStateChanged: async (payload) => {
                        if (import.meta.env.DEV) {
                            console.debug('onCustomerStateChanged (syncing fresh state)', payload)
                        }

                        const polarCustomerId = payload.data.id
                        if (!polarCustomerId) {
                            return
                        }

                        await syncSubscriptionByPolarCustomerId(polarCustomerId)
                    },
                }),
            ],
        }),
    ],
})
