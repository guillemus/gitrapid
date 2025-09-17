import type { Doc, TableNames } from '@convex/_generated/dataModel'
import { internalMutation, type MutationCtx } from '@convex/_generated/server'
import type { WithoutSystemFields } from 'convex/server'
import { v, type Infer } from 'convex/values'
import schema, * as schemas from '../schema'
import { IssueComments } from './issueComments'
import { Issues } from './issues'
import { IssueTimelineItems } from './issueTimelineItems'
import { Repos } from './repos'

export type UpsertDoc<T extends TableNames> = WithoutSystemFields<Doc<T>>

export const IssuesUtils = {
    async getOrCreateIssue(ctx: MutationCtx, args: UpsertDoc<'issues'>) {
        let issue = await Issues.getByRepoAndNumber(ctx, args)
        if (issue) {
            return issue
        }

        let id = await ctx.db.insert('issues', args)

        // Update repo counts on insert
        if (args.state === 'open') {
            await Repos.addToOpenIssuesCount(ctx, args.repoId, 1)
        } else {
            await Repos.addToClosedIssuesCount(ctx, args.repoId, 1)
        }

        return await ctx.db.get(id)
    },

    async upsertIssue(ctx: MutationCtx, args: UpsertDoc<'issues'>) {
        let existing = await Issues.getByRepoAndNumber(ctx, args)
        if (existing) {
            // Adjust counts if state changed
            if (existing.state !== args.state) {
                if (args.state === 'open') {
                    await Repos.addToOpenIssuesCount(ctx, existing.repoId, 1)
                    await Repos.addToClosedIssuesCount(ctx, existing.repoId, -1)
                } else {
                    await Repos.addToOpenIssuesCount(ctx, existing.repoId, -1)
                    await Repos.addToClosedIssuesCount(ctx, existing.repoId, 1)
                }
            }
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        // Insert new issue and bump counts
        let id = await ctx.db.insert('issues', args)
        if (args.state === 'open') {
            await Repos.addToOpenIssuesCount(ctx, args.repoId, 1)
        } else {
            await Repos.addToClosedIssuesCount(ctx, args.repoId, 1)
        }

        return await ctx.db.get(id)
    },

    async upsertIssueBody(ctx: MutationCtx, args: UpsertDoc<'issueBodies'>) {
        let existing = await ctx.db
            .query('issueBodies')
            .withIndex('by_issue_id', (q) => q.eq('issueId', args.issueId))
            .unique()
        if (existing) {
            await ctx.db.patch(existing._id, args)
        } else {
            await ctx.db.insert('issueBodies', args)
        }
    },
}

const timelineItemVal = v.object(schemas.issueTimelineItemsSchemaWithoutIssueId)
const commentVal = v.object(schemas.issuesCommentsWithoutIssueIdSchema)

export type TimelineItemForInsert = Infer<typeof timelineItemVal>
export type CommentForInsert = Infer<typeof commentVal>

export const insertIssuesWithCommentsBatch = internalMutation({
    args: {
        items: v.array(
            v.object({
                issue: v.object(schemas.issuesSchema),
                body: v.string(),
                timelineItems: v.array(timelineItemVal),
                comments: v.array(commentVal),
            }),
        ),
    },
    handler: async (ctx, { items }) => {
        for (let item of items) {
            let issueDoc = await IssuesUtils.upsertIssue(ctx, item.issue)

            if (!issueDoc) continue

            if (item.body) {
                await IssuesUtils.upsertIssueBody(ctx, {
                    repoId: issueDoc.repoId,
                    issueId: issueDoc._id,
                    body: item.body,
                })
            }

            if (item.timelineItems.length > 0) {
                let docs: UpsertDoc<'issueTimelineItems'>[] = []
                for (let t of item.timelineItems) {
                    docs.push({
                        actor: t.actor,
                        createdAt: t.createdAt,
                        githubNodeId: t.githubNodeId,
                        item: t.item,
                        issueId: issueDoc._id,
                        repoId: issueDoc.repoId,
                    })
                }
                await IssueTimelineItems.deleteByIssueId(ctx, issueDoc._id)
                await IssueTimelineItems.insertMany(ctx, docs)
            }

            if (item.comments.length > 0) {
                let docs: UpsertDoc<'issueComments'>[] = []
                for (let c of item.comments) {
                    docs.push({
                        issueId: issueDoc._id,
                        repoId: issueDoc.repoId,
                        githubId: c.githubId,
                        author: c.author,
                        body: c.body,
                        createdAt: c.createdAt,
                        updatedAt: c.updatedAt,
                    })
                }
                await IssueComments.deleteByIssueId(ctx, issueDoc._id)
                await IssueComments.insertMany(ctx, docs)
            }
        }

        return null
    },
})
