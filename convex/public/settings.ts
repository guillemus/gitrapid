import { internal } from '@convex/_generated/api'
import { action, internalMutation, mutation, query } from '@convex/_generated/server'
import { PATs } from '@convex/models/pats'
import { Users } from '@convex/models/users'
import schema, { v_tokenScopes } from '@convex/schema'
import { Auth } from '@convex/services/auth'
import { Github } from '@convex/services/github'
import { ok, wrap } from '@convex/shared'
import { publicAction, publicMutation, publicQuery } from '@convex/utils'
import { doc } from 'convex-helpers/validators'
import { v } from 'convex/values'

export const get = publicQuery({
    args: {},
    async handler(ctx) {
        let pat = await PATs.getByUserId.handler(ctx, { userId: ctx.userId })
        if (!pat) return 'PAT_NOT_SET'

        return {
            scopes: pat.scopes,
            expiresAt: pat.expiresAt,
        }
    },
})

export const handleCorrectPATAddition = internalMutation({
    args: {
        userId: v.id('users'),
        githubUser: v.object({
            id: v.number(),
            login: v.string(),
            avatarUrl: v.string(),
        }),
        token: v.object({
            value: v.string(),
            scopes: v_tokenScopes,
            expiresAt: v.string(),
        }),
    },
    async handler(ctx, args) {
        let githubUserId = await Users.getOrCreateGithubUser.handler(ctx, {
            githubId: args.githubUser.id,
            login: args.githubUser.login,
            avatarUrl: args.githubUser.avatarUrl,
        })

        await PATs.upsertForUser.handler(ctx, {
            githubUser: githubUserId,
            userId: args.userId,
            token: args.token.value,
            scopes: args.token.scopes,
            expiresAt: args.token.expiresAt,
        })

        await ctx.scheduler.runAfter(0, internal.services.sync.startSyncNotifs, {
            userId: args.userId,
        })

        return ok()
    },
})

export const savePAT = publicAction({
    args: {
        token: v.string(),
        scopes: doc(schema, 'pats').fields.scopes,
    },
    async handler(ctx, { token, scopes }): R {
        let res = await Github.getUserAndTokenExpiration({ token })
        if (res.isErr) {
            return wrap('Failed to validate token', res)
        }

        let githubUserId = await ctx.runMutation(internal.models.users.getOrCreateGithubUser, {
            githubId: res.val.githubUser.githubId,
            login: res.val.githubUser.login,
            avatarUrl: res.val.githubUser.avatarUrl,
        })
        await ctx.runMutation(internal.models.pats.upsertForUser, {
            githubUser: githubUserId,
            userId: ctx.userId,
            token,
            scopes,
            expiresAt: res.val.expiration.toISOString(),
        })

        await ctx.scheduler.runAfter(0, internal.services.sync.startSyncNotifs, {
            userId: ctx.userId,
        })

        return ok()
    },
})

export const deletePAT = publicMutation({
    args: {},
    async handler(ctx) {
        let pat = await PATs.getByUserId.handler(ctx, { userId: ctx.userId })

        if (pat) {
            await ctx.db.delete(pat._id)
        }
    },
})
