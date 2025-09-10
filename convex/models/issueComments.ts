import type { Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import { protectedMutation } from '@convex/utils'
import { v } from 'convex/values'
import * as schemas from '../schema'
import type { UpsertDoc } from './models'

export const IssueComments = {
    async listByIssueId(ctx: QueryCtx, issueId: Id<'issues'>) {
        return ctx.db
            .query('issueComments')
            .withIndex('by_issue', (q) => q.eq('issueId', issueId))
            .collect()
    },

    async insertMany(ctx: MutationCtx, docs: UpsertDoc<'issueComments'>[]) {
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
        args: UpsertDoc<'issueComments'>,
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

export const insertMany = protectedMutation({
    args: { comments: v.array(v.object(schemas.issueCommentsSchema)) },
    handler: (ctx, args) => IssueComments.insertMany(ctx, args.comments),
})
