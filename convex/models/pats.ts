import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
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
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'pats'>) {
        let existing = await this.getByUserId(ctx, args.userId)
        if (existing) {
            return existing
        }
        let id = await ctx.db.insert('pats', args)
        return await ctx.db.get(id)
    },
}

export const getByUserId = protectedQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => PATs.getByUserId(ctx, userId),
})

export const getOrCreate = protectedMutation({
    args: schemas.patsSchema,
    handler: (ctx, args) => PATs.getOrCreate(ctx, args),
})
