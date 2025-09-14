import { type QueryCtx } from '@convex/_generated/server'
import { protectedQuery } from '@convex/localcx'
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

export const getByProviderAndAccountId = protectedQuery({
    args: { githubUserId: v.number() },
    handler: (ctx, { githubUserId }) =>
        AuthAccounts.getByProviderAndAccountId(ctx, githubUserId.toString()),
})
