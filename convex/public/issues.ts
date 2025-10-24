import { IssueBodies } from '@convex/models/issueBodies'
import { IssueComments } from '@convex/models/issueComments'
import { Issues } from '@convex/models/issues'
import { IssueTimelineItems } from '@convex/models/issueTimelineItems'
import { Auth } from '@convex/services/auth'
import { unwrap } from '@convex/shared'
import { publicQuery } from '@convex/utils'
import { v } from 'convex/values'

export const getById = publicQuery({
    args: {
        issueId: v.id('issues'),
    },
    handler(ctx, args) {
        return ctx.db.get(args.issueId)
    },
})

export const get = publicQuery({
    args: {
        owner: v.string(),
        repo: v.string(),
        number: v.number(),
    },
    async handler(ctx, args) {
        let userRepo = await Auth.getUserAssociatedRepo.handler(ctx, {
            userId: ctx.userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(userRepo)

        let issue = await Issues.getByRepoAndNumberWithRelations.handler(ctx, {
            number: args.number,
            repoId: savedRepo._id,
        })
        if (!issue) return null

        let [body, assignees, labels] = await Promise.all([
            IssueBodies.getByIssueId(ctx, issue._id),
            Issues.getAssigneesByIssueId.handler(ctx, { issueId: issue._id }),
            Issues.getLabelsByIssueId.handler(ctx, { issueId: issue._id }),
        ])

        let timelineItems = await IssueTimelineItems.listByIssueId(ctx, issue._id)
        let comments = await IssueComments.listByIssueIdWithRelations(ctx, issue._id)

        let thread = []
        thread.push(
            ...comments.map((c) => ({
                type: 'comment' as const,
                createdAt: c.createdAt,
                comment: c,
            })),
        )
        thread.push(
            ...timelineItems.map((t) => ({
                type: 'timelineItem' as const,
                createdAt: t.createdAt,
                timelineItem: t,
            })),
        )

        thread.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        return {
            issue,
            assignees,
            labels,
            body,
            thread,
        }
    },
})
