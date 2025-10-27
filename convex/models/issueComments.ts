import type { Doc, Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import { fetchGithubUser, type GithubUserDoc } from './issueTimelineItems'
import type { UpsertDoc } from './models'

export type CommentWithRelations = Omit<Doc<'issueComments'>, 'author'> & {
    author: GithubUserDoc
}

export const IssueComments = {
    async listByIssueId(ctx: QueryCtx, issueId: Id<'issues'>) {
        return ctx.db
            .query('issueComments')
            .withIndex('by_issue', (q) => q.eq('issueId', issueId))
            .collect()
    },

    async listByIssueIdWithRelations(ctx: QueryCtx, issueId: Id<'issues'>) {
        let comments = await this.listByIssueId(ctx, issueId)
        let commentsWithRelations: CommentWithRelations[] = []
        for (let comment of comments) {
            let commentAuthor = await fetchGithubUser(ctx, comment.author)

            commentsWithRelations.push({
                ...comment,
                author: commentAuthor,
            })
        }

        return commentsWithRelations
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

    async search(ctx: QueryCtx, repoId: Id<'repos'>, q: string) {
        let matches = await ctx.db
            .query('issueComments')
            .withSearchIndex('search_issue_comments', (s) =>
                s.search('body', q).eq('repoId', repoId),
            )
            .collect()
        return matches
    },
}
