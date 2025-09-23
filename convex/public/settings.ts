import { internal } from '@convex/_generated/api'
import { action, mutation, query } from '@convex/_generated/server'
import schema from '@convex/schema'
import { getUserId } from '@convex/services/auth'
import { Github } from '@convex/services/github'
import { ok, wrap } from '@convex/shared'
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
        scopes: schema.tables.pats.validator.fields.scopes,
    },
    async handler(ctx, { token, scopes }): R {
        let userId = await getUserId(ctx)

        let expiresAt = await Github.getTokenExpiration(token)
        if (expiresAt.isErr) {
            return wrap('Failed to validate token', expiresAt)
        }

        await ctx.runMutation(internal.models.pats.upsertForUser, {
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
