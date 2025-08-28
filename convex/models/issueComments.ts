import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation } from '../utils'
import * as models from './models'

export const IssueComments = {
    async insertIfNotExists(
        ctx: MutationCtx,
        issueCommentId: Id<'issueComments'>,
        doc: models.UpsertDoc<'issueComments'>,
    ) {
        let existing = await ctx.db.get(issueCommentId)
        if (existing) {
            return existing
        }

        let id = await ctx.db.insert('issueComments', doc)
        return await ctx.db.get(id)
    },
    async insertMany(ctx: MutationCtx, docs: models.UpsertDoc<'issueComments'>[]) {
        let ids: Id<'issueComments'>[] = []
        for (let doc of docs) {
            let id = await ctx.db.insert('issueComments', doc)
            ids.push(id)
        }
        return ids
    },

    async upsert(
        ctx: MutationCtx,
        issueCommentId: Id<'issueComments'>,
        args: models.UpsertDoc<'issueComments'>,
    ) {
        let existing = await ctx.db.get(issueCommentId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }
        let id = await ctx.db.insert('issueComments', args)
        return await ctx.db.get(id)
    },
}

export const insertIfNotExists = protectedMutation({
    args: {
        issueCommentId: v.id('issueComments'),
        doc: v.object(schemas.issueCommentsSchema),
    },
    handler: (ctx, args) => IssueComments.insertIfNotExists(ctx, args.issueCommentId, args.doc),
})

export const insertMany = protectedMutation({
    args: { comments: v.array(v.object(schemas.issueCommentsSchema)) },
    handler: (ctx, args) => IssueComments.insertMany(ctx, args.comments),
})
