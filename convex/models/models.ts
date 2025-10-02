import type { Doc, TableNames } from '@convex/_generated/dataModel'
import { internalMutation, type MutationCtx } from '@convex/_generated/server'
import { logger, type FnArgs } from '@convex/utils'
import { assert } from 'convex-helpers'
import type { WithoutSystemFields } from 'convex/server'
import { v, type Infer } from 'convex/values'
import schema from '../schema'
import { IssueComments } from './issueComments'
import { AssignLabelToIssue, AssignUserToIssue, Issues } from './issues'
import { IssueTimelineItems } from './issueTimelineItems'
import { Repos } from './repos'
import { possibleGithubUserData, upsertPossibleGithubUser } from './users'

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

const issueData = v.object({
    githubId: v.number(),
    number: v.number(),
    title: v.string(),
    state: v.union(v.literal('open'), v.literal('closed')),
    author: possibleGithubUserData,
    createdAt: v.string(),
    updatedAt: v.string(),
    closedAt: v.optional(v.string()),
    comments: v.optional(v.number()),
})

const label = v.object({
    githubId: v.string(),
    name: v.string(),
    color: v.string(),
})

export type TimelineItemData = Infer<typeof timelineItem>

const timelineItem = v.object({
    actor: possibleGithubUserData,
    createdAt: v.string(),
    item: v.union(
        v.object({ type: v.literal('assigned'), assignee: possibleGithubUserData }),
        v.object({ type: v.literal('unassigned'), assignee: possibleGithubUserData }),
        v.object({ type: v.literal('labeled'), label }),
        v.object({ type: v.literal('unlabeled'), label }),
        v.object({ type: v.literal('milestoned'), milestoneTitle: v.string() }),
        v.object({ type: v.literal('demilestoned'), milestoneTitle: v.string() }),
        v.object({ type: v.literal('locked') }),
        v.object({ type: v.literal('unlocked') }),
        v.object({ type: v.literal('pinned') }),
        v.object({ type: v.literal('unpinned') }),
        v.object({ type: v.literal('closed') }),
        v.object({ type: v.literal('reopened') }),
        v.object({
            type: v.literal('renamed'),
            previousTitle: v.string(),
            currentTitle: v.string(),
        }),
        v.object({
            type: v.literal('referenced'),
            commit: v.object({ oid: v.string(), url: v.string() }),
        }),
        v.object({
            type: v.literal('cross_referenced'),
            source: v.object({
                type: v.union(v.literal('Issue'), v.literal('PullRequest')),
                owner: v.string(),
                name: v.string(),
                number: v.number(),
            }),
        }),
        v.object({
            type: v.literal('transferred'),
            fromRepository: v.object({ owner: v.string(), name: v.string() }),
        }),
    ),
})

export type CommentData = Infer<typeof comment>

const comment = v.object({
    author: possibleGithubUserData,
    githubId: v.number(),
    body: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    reactions: v.optional(
        v.array(
            v.object({
                user: possibleGithubUserData,
                content: v.string(),
            }),
        ),
    ),
    isDeleted: v.optional(v.boolean()),
})

const UpsertLabel = {
    args: schema.tables.labels.validator.fields,
    async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
        let githubUser = await ctx.db
            .query('labels')
            .withIndex('by_githubId', (u) => u.eq('githubId', args.githubId))
            .unique()
        if (githubUser) {
            await ctx.db.patch(githubUser._id, args)
            return githubUser._id
        } else {
            let id = await ctx.db.insert('labels', args)
            return id
        }
    },
}

const issueDataForInsert = v.object({
    issue: issueData,
    body: v.string(),
    labels: v.array(
        v.object({
            githubId: v.string(),
            name: v.string(),
            color: v.string(),
        }),
    ),
    assignees: v.array(v.object(schema.tables.githubUsers.validator.fields)),
    timelineItems: v.array(timelineItem),
    comments: v.array(comment),
})

export type IssueData = Infer<typeof issueData>

export const insertIssuesWithCommentsBatch = internalMutation({
    args: {
        repoId: v.id('repos'),
        items: v.array(issueDataForInsert),
    },
    handler: async (ctx, { repoId, items }) => {
        for (let item of items) {
            let author = await upsertPossibleGithubUser(ctx, item.issue.author)

            let issueDoc = await IssuesUtils.upsertIssue(ctx, {
                repoId,
                author,
                githubId: item.issue.githubId,
                number: item.issue.number,
                title: item.issue.title,
                state: item.issue.state,
                createdAt: item.issue.createdAt,
                updatedAt: item.issue.updatedAt,
            })
            assert(issueDoc, 'issue doc not found')

            if (item.body) {
                await IssuesUtils.upsertIssueBody(ctx, {
                    repoId: issueDoc.repoId,
                    issueId: issueDoc._id,
                    body: item.body,
                })
            }

            if (item.labels.length > 0) {
                for (let l of item.labels) {
                    await AssignLabelToIssue.handler(ctx, {
                        repoId: issueDoc.repoId,
                        issueId: issueDoc._id,
                        githubId: l.githubId,
                        name: l.name,
                        color: l.color,
                    })
                }
            }

            if (item.assignees.length) {
                for (let a of item.assignees) {
                    await AssignUserToIssue.handler(ctx, {
                        issueId: issueDoc._id,
                        githubId: a.githubId,
                        login: a.login,
                        avatarUrl: a.avatarUrl,
                    })
                }
            }

            if (item.timelineItems.length > 0) {
                let docs: UpsertDoc<'issueTimelineItems'>[] = []
                for (let t of item.timelineItems) {
                    let actor = await upsertPossibleGithubUser(ctx, t.actor)

                    let item: UpsertDoc<'issueTimelineItems'>['item']
                    if (t.item.type === 'assigned') {
                        let assignee = await upsertPossibleGithubUser(ctx, t.item.assignee)

                        item = { type: 'assigned', assignee }
                    } else if (t.item.type === 'unassigned') {
                        let assignee = await upsertPossibleGithubUser(ctx, t.item.assignee)

                        item = { type: 'unassigned', assignee }
                    } else if (t.item.type === 'labeled') {
                        let labelId = await UpsertLabel.handler(ctx, {
                            repoId: issueDoc.repoId,
                            githubId: t.item.label.githubId,
                            name: t.item.label.name,
                            color: t.item.label.color,
                        })

                        item = { type: 'labeled', label: labelId }
                    } else if (t.item.type === 'unlabeled') {
                        let labelId = await UpsertLabel.handler(ctx, {
                            repoId: issueDoc.repoId,
                            githubId: t.item.label.githubId,
                            name: t.item.label.name,
                            color: t.item.label.color,
                        })

                        item = { type: 'unlabeled', label: labelId }
                    } else if (t.item.type === 'milestoned') {
                        item = { type: 'milestoned', milestoneTitle: t.item.milestoneTitle }
                    } else if (t.item.type === 'demilestoned') {
                        item = { type: 'demilestoned', milestoneTitle: t.item.milestoneTitle }
                    } else if (t.item.type === 'locked') {
                        item = { type: 'locked' }
                    } else if (t.item.type === 'unlocked') {
                        item = { type: 'unlocked' }
                    } else if (t.item.type === 'pinned') {
                        item = { type: 'pinned' }
                    } else if (t.item.type === 'unpinned') {
                        item = { type: 'unpinned' }
                    } else if (t.item.type === 'closed') {
                        item = { type: 'closed' }
                    } else if (t.item.type === 'reopened') {
                        item = { type: 'reopened' }
                    } else if (t.item.type === 'renamed') {
                        item = {
                            type: 'renamed',
                            previousTitle: t.item.previousTitle,
                            currentTitle: t.item.currentTitle,
                        }
                    } else if (t.item.type === 'referenced') {
                        item = {
                            type: 'referenced',
                            commit: { oid: t.item.commit.oid, url: t.item.commit.url },
                        }
                    } else if (t.item.type === 'cross_referenced') {
                        item = {
                            type: 'cross_referenced',
                            source: {
                                type: t.item.source.type,
                                owner: t.item.source.owner,
                                name: t.item.source.name,
                                number: t.item.source.number,
                            },
                        }
                    } else if (t.item.type === 'transferred') {
                        item = {
                            type: 'transferred',
                            fromRepository: {
                                owner: t.item.fromRepository.owner,
                                name: t.item.fromRepository.name,
                            },
                        }
                    } else {
                        let _ = t.item satisfies never
                        logger.error({ item: t.item }, `unknown timeline item`)
                        continue
                    }

                    docs.push({
                        actor,
                        createdAt: t.createdAt,
                        issueId: issueDoc._id,
                        repoId: issueDoc.repoId,
                        item,
                    })
                }

                await IssueTimelineItems.deleteByIssueId(ctx, issueDoc._id)
                await IssueTimelineItems.insertMany(ctx, docs)
            }

            if (item.comments.length > 0) {
                let docs: UpsertDoc<'issueComments'>[] = []
                for (let c of item.comments) {
                    let author = await upsertPossibleGithubUser(ctx, c.author)

                    docs.push({
                        issueId: issueDoc._id,
                        repoId: issueDoc.repoId,
                        githubId: c.githubId,
                        author,
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
