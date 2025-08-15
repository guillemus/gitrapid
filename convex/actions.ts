import { v } from 'convex/values'
import { api } from './_generated/api'
import { action } from './_generated/server'
import { getTokenExpiration } from './services/github'
import { getUserId, SECRET } from './utils'
import { scopesSchema } from './schema'
import { ok, wrap } from './shared'

export const savePAT = action({
    args: {
        token: v.string(),
        scopes: scopesSchema,
    },
    async handler(ctx, { token, scopes }): R {
        let userId = await getUserId(ctx)

        let expiresAt = await getTokenExpiration(token)
        if (expiresAt.isErr) {
            return wrap('Failed to validate token', expiresAt)
        }

        expiresAt

        // Save to database
        await ctx.runMutation(api.models.pats.upsertForUser, {
            ...SECRET,
            userId,
            token,
            scopes,
            expiresAt: expiresAt.val.toISOString(),
        })

        return ok()
    },
})
