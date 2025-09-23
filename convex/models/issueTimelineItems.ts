import type { Id } from '@convex/_generated/dataModel'
import { internalMutation, type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import schema from '../schema'
import type { UpsertDoc } from './models'

export const IssueTimelineItems = {
    async listByIssueId(ctx: QueryCtx, issueId: Id<'issues'>) {
        return ctx.db
            .query('issueTimelineItems')
            .withIndex('by_issueId', (q) => q.eq('issueId', issueId))
            .collect()
    },

    async insertMany(ctx: MutationCtx, docs: UpsertDoc<'issueTimelineItems'>[]) {
        let ids: Id<'issueTimelineItems'>[] = []
        for (let doc of docs) {
            let id = await ctx.db.insert('issueTimelineItems', doc)
            ids.push(id)
        }
        return ids
    },

    async deleteByIssueId(ctx: MutationCtx, issueId: Id<'issues'>) {
        let items = await ctx.db
            .query('issueTimelineItems')
            .withIndex('by_issueId', (q) => q.eq('issueId', issueId))
            .collect()
        let deletedIds: Id<'issueTimelineItems'>[] = []
        for (let item of items) {
            await ctx.db.delete(item._id)
            deletedIds.push(item._id)
        }
        return deletedIds
    },
}

export const insertMany = internalMutation({
    args: {
        issueId: v.id('issues'),
        timelineItems: v.array(v.object(schema.tables.issueTimelineItems.validator.fields)),
    },
    handler: (ctx, args) => IssueTimelineItems.insertMany(ctx, args.timelineItems),
})
