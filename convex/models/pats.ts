import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import type { FnArgs } from '@convex/utils'
import { assert } from 'convex-helpers'
import { partial } from 'convex-helpers/validators'
import { v } from 'convex/values'
import schema, { etag } from '../schema'
import type { UpsertDoc } from './models'

/**
 * Personal Access Tokens
 */
export namespace PATs {
    export const getByUserId = {
        args: { userId: v.id('users') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
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
        async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
            let existing = await getByUserId.handler(ctx, { userId: args.userId })
            if (existing) {
                await ctx.db.delete(existing._id)
            }
            return existing
        },
    }

    export const updateNotifSince = {
        args: { patId: v.id('pats'), since: v.string() },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
            await ctx.db.patch(args.patId, {
                notificationsSince: args.since,
            })
        },
    }
}

export const getByUserId = internalQuery(PATs.getByUserId)
export const upsertForUser = internalMutation(PATs.upsertForUser)
export const deleteByUserId = internalMutation(PATs.deleteByUserId)
export const updateNotifSince = internalMutation(PATs.updateNotifSince)

export const patch = internalMutation({
    args: {
        id: v.id('pats'),
        pat: partial(schema.tables.pats.validator),
    },
    handler: (ctx, args) => ctx.db.patch(args.id, args.pat),
})

export const getRepoIssueEtag = internalQuery({
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

        let patRepo = await ctx.db
            .query('patsRepos')
            .withIndex('by_pat_repo_id', (q) => q.eq('patId', pat._id).eq('repoId', args.repoId))
            .unique()

        return {
            ...pat,
            issuesEtag: patRepo?.issuesEtag,
        }
    },
})

export const upsertEtagsForUser = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        issuesEtag: etag,
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
