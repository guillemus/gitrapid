import { api } from '@convex/_generated/api'
import { action, mutation, query } from '@convex/_generated/server'
import { scopesSchema } from '@convex/schema'
import { getUserId } from '@convex/services/auth'
import { getTokenExpiration } from '@convex/services/github'
import { ok, wrap } from '@convex/shared'
import { SECRET } from '@convex/utils'
import { v } from 'convex/values'

export const get = query({
    args: {},
    async handler(ctx) {
        let userId = await getUserId(ctx)
        let pat = await ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', userId))
            .unique()

        if (!pat) return 'PAT_NOT_SET'

        return {
            scopes: pat.scopes,
            expiresAt: pat.expiresAt,
        }
    },
})

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

export const deletePAT = mutation({
    args: {},
    async handler(ctx) {
        let userId = await getUserId(ctx)

        let pat = await ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', userId))
            .unique()

        if (pat) {
            await ctx.db.delete(pat._id)
        }
    },
})
