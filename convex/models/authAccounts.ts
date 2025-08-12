import { v } from 'convex/values'
import { protectedQuery } from '../utils'
import * as models from './models'

export const getByProviderAndAccountId = protectedQuery({
    args: { githubUserId: v.number() },
    handler: (ctx, { githubUserId }) =>
        models.AuthAccounts.getByProviderAndAccountId(ctx, githubUserId.toString()),
})
