import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import type { FnArgs } from '@convex/utils'
import { partial } from 'convex-helpers/validators'
import { v } from 'convex/values'
import schema from '../schema'
import type { UpsertDoc } from './models'

/**
 * Personal Access Tokens
 */
export namespace PATs {
    export const getByUserId = {
        args: { userId: v.id('users') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this>) {
            return ctx.db
                .query('pats')
                .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
                .unique()
        },
    }

    export const upsertForUser = {
        args: schema.tables.pats.validator.fields,
        async handler(ctx: MutationCtx, args: UpsertDoc<'pats'>) {
            let existing = await getByUserId.handler(ctx, { userId: args.userId })
            if (existing) {
                await ctx.db.patch(existing._id, args)
                return await ctx.db.get(existing._id)
            }
            let id = await ctx.db.insert('pats', args)
            return await ctx.db.get(id)
        },
    }

    export const deleteByUserId = {
        args: { userId: v.id('users') },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let existing = await getByUserId.handler(ctx, { userId: args.userId })
            if (existing) {
                await ctx.db.delete(existing._id)
            }
            return existing
        },
    }
}

export const getByUserId = internalQuery(PATs.getByUserId)
export const upsertForUser = internalMutation(PATs.upsertForUser)
export const deleteByUserId = internalMutation(PATs.deleteByUserId)

export const patch = internalMutation({
    args: {
        id: v.id('pats'),
        pat: partial(schema.tables.pats.validator),
    },
    handler: (ctx, args) => ctx.db.patch(args.id, args.pat),
})
