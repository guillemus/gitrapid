import type { Id } from '@convex/_generated/dataModel'
import type { QueryCtx } from '@convex/_generated/server'

export const Users = {
    async get(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db.get(userId)
    },
}
