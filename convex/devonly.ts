import { v } from 'convex/values'
import { query } from './_generated/server'
import { appEnv } from './env'

export const listTable = query({
    args: { table: v.any() },
    async handler(ctx, { table }) {
        if (!appEnv.DEV) throw new Error('dev only')

        return ctx.db.query(table).take(100)
    },
})
