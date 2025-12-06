import { appEnv } from '@/lib/app-env'
import { prisma } from '@/lib/db'
import { polar } from '@/polar'
import { checkout, polar as polarPlugin, portal, webhooks } from '@polar-sh/better-auth'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
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
        tanstackStartCookies(),
        polarPlugin({
            client: polar,
            createCustomerOnSignUp: true,
            use: [
                checkout({
                    products: [
                        { productId: appEnv.POLAR_PRODUCT_MONTHLY_ID, slug: 'monthly' },
                        { productId: appEnv.POLAR_PRODUCT_YEARLY_ID, slug: 'yearly' },
                    ],
                    successUrl: '/success?checkout_id={CHECKOUT_ID}',
                    authenticatedUsersOnly: true,
                }),
                portal(),
                webhooks({
                    secret: appEnv.POLAR_WEBHOOK_SECRET,
                    onCustomerStateChanged: async (payload) => {
                        const userId = payload.data.externalId
                        if (!userId) return

                        const activeSub = payload.data.activeSubscriptions?.[0]
                        const status = activeSub ? activeSub.status : 'none'

                        await prisma.subscription.upsert({
                            where: { userId },
                            create: {
                                userId,
                                polarCustomerId: payload.data.id,
                                polarSubscriptionId: activeSub?.id ?? null,
                                productId: activeSub?.productId ?? null,
                                status,
                                currentPeriodEnd: activeSub?.currentPeriodEnd ?? null,
                            },
                            update: {
                                polarSubscriptionId: activeSub?.id ?? null,
                                productId: activeSub?.productId ?? null,
                                status,
                                currentPeriodEnd: activeSub?.currentPeriodEnd ?? null,
                            },
                        })
                    },
                }),
            ],
        }),
    ],
})
