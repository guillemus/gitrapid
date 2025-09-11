// Queries here are meant to be used for debugging only

import { v } from 'convex/values'
import { internalQuery } from './_generated/server'

export const listTable = internalQuery({
    args: {
        tableName: v.any(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (ctx, args) => ctx.db.query(args.tableName).collect() as any,
})
