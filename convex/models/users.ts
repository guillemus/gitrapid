import type { Id } from '@convex/_generated/dataModel'
import { query, type QueryCtx } from '@convex/_generated/server'
import { getUserId } from '@convex/services/auth'
import { protectedMutation, protectedQuery } from '@convex/utils'
import { v } from 'convex/values'

export const Users = {
    async get(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db.get(userId)
    },
    async list(ctx: QueryCtx) {
        return ctx.db.query('users').collect()
    },
}

export const list = protectedQuery({
    args: {},
    handler: (ctx) => Users.list(ctx),
})

export const insert = protectedMutation({
    args: {
        name: v.string(),
    },
    handler: (ctx, args) => ctx.db.insert('users', { name: args.name }),
})

export const doSomethingAsUser = query({
    async handler(ctx, args) {
        let userId = await getUserId(ctx)
        console.log('userId', userId)
        let user = await ctx.db.get(userId)
        console.log('user identity', user)
    },
})
