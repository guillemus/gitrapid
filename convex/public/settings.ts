import { internal } from '@convex/_generated/api'
import { action, mutation, query } from '@convex/_generated/server'
import { PATs } from '@convex/models/pats'
import schema from '@convex/schema'
import { Auth } from '@convex/services/auth'
import { Github } from '@convex/services/github'
import { ok, wrap } from '@convex/shared'
import { workflow } from '@convex/workflow'
import { doc } from 'convex-helpers/validators'
import { v } from 'convex/values'

export const get = query({
    args: {},
    async handler(ctx) {
        let userId = await Auth.getUserId(ctx)
        let pat = await PATs.getByUserId.handler(ctx, { userId })
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
        scopes: doc(schema, 'pats').fields.scopes,
    },
    async handler(ctx, { token, scopes }): R {
        let userId = await Auth.getUserId(ctx)

        let res = await Github.getUserAndTokenExpiration({ token })
        if (res.isErr) {
            return wrap('Failed to validate token', res)
        }

        let githubUserId = await ctx.runMutation(internal.models.users.upsertGithubUser, {
            githubId: res.val.githubUser.githubId,
            login: res.val.githubUser.login,
            avatarUrl: res.val.githubUser.avatarUrl,
        })
        await ctx.runMutation(internal.models.pats.upsertForUser, {
            githubUser: githubUserId,
            userId,
            token,
            scopes,
            expiresAt: res.val.expiration.toISOString(),
        })

        await ctx.scheduler.runAfter(0, internal.services.sync.startSyncNotifsMutation, { userId })

        return ok()
    },
})

export const deletePAT = mutation({
    args: {},
    async handler(ctx) {
        let userId = await Auth.getUserId(ctx)
        let pat = await PATs.getByUserId.handler(ctx, { userId })

        if (pat) {
            await ctx.db.delete(pat._id)
        }
    },
})
