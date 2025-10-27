import { type QueryCtx } from '@convex/_generated/server'

export const AuthAccounts = {
    async getByProviderAndAccountId(ctx: QueryCtx, providerAccountId: string) {
        return ctx.db
            .query('authAccounts')
            .withIndex('providerAndAccountId', (q) =>
                q.eq('provider', 'github').eq('providerAccountId', providerAccountId),
            )
            .unique()
    },
}
