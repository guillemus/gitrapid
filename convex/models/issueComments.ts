import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'

export const IssueComments = {
    async getByGithubId(ctx: QueryCtx, githubId: number) {
        return ctx.db
            .query('issueComments')
            .withIndex('by_github_id', (q) => q.eq('githubId', githubId))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: models.UpsertDoc<'issueComments'>) {
        let existing = await this.getByGithubId(ctx, args.githubId)
        if (existing) {
            return existing
        }
        let id = await ctx.db.insert('issueComments', args)
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

    async upsert(ctx: MutationCtx, args: models.UpsertDoc<'issueComments'>) {
        let existing = await this.getByGithubId(ctx, args.githubId)
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
        for (let c of comments) {
            await ctx.db.delete(c._id)
        }
    },
}

export const getByGithubId = protectedQuery({
    args: { githubId: v.number() },
    handler: (ctx, { githubId }) => IssueComments.getByGithubId(ctx, githubId),
})

export const getOrCreate = protectedMutation({
    args: schemas.issueCommentsSchema,
    handler: (ctx, args) => IssueComments.getOrCreate(ctx, args),
})

export const insertMany = protectedMutation({
    args: { comments: v.array(v.object(schemas.issueCommentsSchema)) },
    handler: (ctx, args) => IssueComments.insertMany(ctx, args.comments),
})

export const upsert = protectedMutation({
    args: schemas.issueCommentsSchema,
    handler: (ctx, args) => IssueComments.upsert(ctx, args),
})

export const deleteByIssueId = protectedMutation({
    args: { issueId: v.id('issues') },
    handler: (ctx, { issueId }) => IssueComments.deleteByIssueId(ctx, issueId),
})
