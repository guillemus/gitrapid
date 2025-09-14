import type { Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import { protectedMutation, protectedQuery } from '@convex/localcx'
import { assert } from 'convex-helpers'
import { partial } from 'convex-helpers/validators'
import { v } from 'convex/values'
import schema, * as schemas from '../schema'
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

export const getEtagsForUser = protectedQuery({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let user = await ctx.db.get(args.userId)
        assert(user, 'user not found')

        let pat = await ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
            .unique()
        assert(pat, 'pat not found')

        return ctx.db
            .query('patsRepos')
            .withIndex('by_pat_repo_id', (q) => q.eq('patId', pat._id).eq('repoId', args.repoId))
            .unique()
    },
})

export const upsertEtagsForUser = protectedMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        issuesEtag: v.string(),
    },
    async handler(ctx, args) {
        let user = await ctx.db.get(args.userId)
        assert(user, 'user not found')

        let pat = await ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
            .unique()
        assert(pat, 'pat not found')

        let patsRepo = await ctx.db
            .query('patsRepos')
            .withIndex('by_pat_repo_id', (q) => q.eq('patId', pat._id).eq('repoId', args.repoId))
            .unique()
        if (patsRepo) {
            await ctx.db.patch(patsRepo._id, { issuesEtag: args.issuesEtag })
        } else {
            await ctx.db.insert('patsRepos', {
                patId: pat._id,
                repoId: args.repoId,
                issuesEtag: args.issuesEtag,
            })
        }
    },
})
