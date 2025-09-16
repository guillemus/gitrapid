import type { Id } from '@convex/_generated/dataModel'
import { internalQuery, type QueryCtx } from '@convex/_generated/server'

export const Users = {
    async get(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db.get(userId)
    },
    async list(ctx: QueryCtx) {
        return ctx.db.query('users').collect()
    },
}

export const list = internalQuery({
    args: {},
    handler: (ctx) => Users.list(ctx),
})
