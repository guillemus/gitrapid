// Queries here are meant to be used for debugging only

import { v } from 'convex/values'
import { devMutation, devQuery } from './utils'

export const listTable = devQuery({
    args: {
        tableName: v.any(),
    },
    handler: (ctx, args) => ctx.db.query(args.tableName).collect() as any,
})

export const truncateTable = devMutation({
    args: {
        tableName: v.any(),
    },
    async handler(ctx, args) {
        let docs = await ctx.db.query(args.tableName).collect()
        for (let doc of docs) {
            await ctx.db.delete(doc._id)
        }

        return `deleted ${docs.length} docs from ${args.tableName}`
    },
})
