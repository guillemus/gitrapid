import { publicMutation, publicQuery } from '@convex/utils'

export const getUser = publicQuery((ctx) => ctx.db.get(ctx.userId))
export const newVersionSeen = publicMutation((ctx) =>
    ctx.db.patch(ctx.userId, { newVersion: false }),
)
