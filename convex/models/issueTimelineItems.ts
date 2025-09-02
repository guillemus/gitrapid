import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation } from '../utils'
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

export const insertMany = protectedMutation({
    args: {
        issueId: v.id('issues'),
        timelineItems: v.array(v.object(schemas.issueTimelineItemsSchema)),
    },
    handler: (ctx, args) => IssueTimelineItems.insertMany(ctx, args.timelineItems),
})
