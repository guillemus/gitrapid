import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation } from '../utils'
import * as models from './models'

export const IssueComments = {
    async listByIssueId(ctx: QueryCtx, issueId: Id<'issues'>) {
        return ctx.db
            .query('issueComments')
            .withIndex('by_issue', (q) => q.eq('issueId', issueId))
            .collect()
    },

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

    async deleteByIssueId(ctx: MutationCtx, issueId: Id<'issues'>) {
        let comments = await ctx.db
            .query('issueComments')
            .withIndex('by_issue', (q) => q.eq('issueId', issueId))
            .collect()
        let deletedIds: Id<'issueComments'>[] = []
        for (let comment of comments) {
            await ctx.db.delete(comment._id)
            deletedIds.push(comment._id)
        }
        return deletedIds
    },

    async search(ctx: QueryCtx, repoId: Id<'repos'>, CAP: number, q: string) {
        let matches = await ctx.db
            .query('issueComments')
            .withSearchIndex('search_issue_comments', (s) =>
                s.search('body', q).eq('repoId', repoId),
            )
            .take(CAP)
        return matches
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
