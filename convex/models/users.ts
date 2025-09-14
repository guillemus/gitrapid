import type { Id } from '@convex/_generated/dataModel'
import { type QueryCtx } from '@convex/_generated/server'
import { protectedQuery } from '@convex/localcx'

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
