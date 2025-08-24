import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { partial } from 'convex-helpers/validators'
import { v } from 'convex/values'
import schema, * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'
import type { UpsertDoc } from './models'

/**
 * Personal Access Tokens
 */
export const PATs = {
    async getByUserId(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', userId))
            .unique()
    },

    async upsertForUser(ctx: MutationCtx, args: UpsertDoc<'pats'>) {
        let existing = await this.getByUserId(ctx, args.userId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }
        let id = await ctx.db.insert('pats', args)
        return await ctx.db.get(id)
    },

    async deleteByUserId(ctx: MutationCtx, userId: Id<'users'>) {
        let existing = await this.getByUserId(ctx, userId)
        if (existing) {
            await ctx.db.delete(existing._id)
        }
        return existing
    },
}

export const getByUserId = protectedQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => PATs.getByUserId(ctx, userId),
})

export const upsertForUser = protectedMutation({
    args: schemas.patsSchema,
    handler: (ctx, args) => PATs.upsertForUser(ctx, args),
})

export const deleteByUserId = protectedMutation({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => PATs.deleteByUserId(ctx, userId),
})

export const patch = protectedMutation({
    args: {
        id: v.id('pats'),
        pat: partial(schema.tables.pats.validator),
    },
    handler: (ctx, args) => ctx.db.patch(args.id, args.pat),
})
