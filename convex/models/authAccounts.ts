import { internalQuery, type QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'

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

export const getByProviderAndAccountId = internalQuery({
    args: { githubUserId: v.number() },
    handler: (ctx, { githubUserId }) =>
        AuthAccounts.getByProviderAndAccountId(ctx, githubUserId.toString()),
})
