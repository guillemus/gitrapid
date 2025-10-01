import { internal } from '@convex/_generated/api'
import { action, query } from '@convex/_generated/server'
import { IssueBodies } from '@convex/models/issueBodies'
import { IssueComments } from '@convex/models/issueComments'
import { Issues } from '@convex/models/issues'
import { IssueTimelineItems } from '@convex/models/issueTimelineItems'
import { Auth, getTokenFromUserId, getUserId } from '@convex/services/auth'
import { Github, newOctokit } from '@convex/services/github'
import { IssueSearch } from '@convex/services/issueSearch'
import { unwrap } from '@convex/shared'
import { logger } from '@convex/utils'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const list = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        state: v.optional(v.union(v.literal('open'), v.literal('closed'))),
        sortBy: v.optional(
            v.union(v.literal('createdAt'), v.literal('updatedAt'), v.literal('comments')),
        ),
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo(ctx, userId, args.owner, args.repo)
        let savedRepo = unwrap(hasAccess)

        let result = await Issues.paginate(ctx, {
            repoId: savedRepo._id,
            state: args.state,
            sortBy: args.sortBy,
            paginationOpts: args.paginationOpts,
        })

        return {
            ...result,
            repo: savedRepo,
        }
    },
})

export const search = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        search: v.string(),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo(ctx, userId, args.owner, args.repo)
        let savedRepo = unwrap(hasAccess)

        let issues = await IssueSearch.search(ctx, savedRepo, args.search)

        return issues
    },
})

export const get = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        number: v.number(),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo(ctx, userId, args.owner, args.repo)
        let savedRepo = unwrap(hasAccess)

        let issue = await Issues.getByRepoAndNumberWithRelations(ctx, {
            number: args.number,
            repoId: savedRepo._id,
        })
        if (!issue) return null

        let assignees = await Issues.getAssigneesByIssueId(ctx, issue._id)
        let labels = await Issues.getLabelsByIssueId(ctx, issue._id)
        let body = await IssueBodies.getByIssueId(ctx, issue._id)
        let timelineItems = await IssueTimelineItems.listByIssueId(ctx, issue._id)
        let comments = await IssueComments.listByIssueIdWithRelations(ctx, issue._id)

        return {
            issue,
            assignees,
            labels,
            body,
            timelineItems,
            comments,
        }
    },
})

export const create = action({
    args: {
        owner: v.string(),
        repo: v.string(),
        title: v.string(),
        body: v.string(),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)
        let hasAccess = await ctx.runQuery(internal.services.auth.hasUserAccessToRepo, {
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let token = await getTokenFromUserId(ctx, userId)
        if (token.isErr) throw new Error('no PAT found')

        let octo = newOctokit(token.val)

        let createdIssue = await Github.createIssue(octo, {
            owner: args.owner,
            repo: args.repo,
            title: args.title,
            body: args.body,
            repoId: savedRepo._id,
        })
        if (createdIssue.isErr) {
            logger.error(`octo error: failed to create issue: ${createdIssue.err}`)
            throw new Error('octo error: failed to create issue')
        }

        await ctx.runMutation(internal.models.issues.insertOpenUserIssueWithBody, {
            repoId: savedRepo._id,
            title: createdIssue.val.title,
            createdAt: createdIssue.val.created_at,
            updatedAt: createdIssue.val.updated_at,
            githubId: createdIssue.val.id,
            number: createdIssue.val.number,
            body: args.body,
        })

        return { githubIssueNumber: createdIssue.val.number }
    },
})

export const addComment = action({
    args: {
        owner: v.string(),
        repo: v.string(),
        number: v.number(),
        comment: v.string(),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)
        let hasAccess = await ctx.runQuery(internal.services.auth.hasUserAccessToRepo, {
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let token = await getTokenFromUserId(ctx, userId)
        if (token.isErr) throw new Error('no PAT found')

        let octo = newOctokit(token.val)

        let issue = await ctx.runQuery(internal.models.issues.getByRepoAndNumber, {
            repoId: savedRepo._id,
            number: args.number,
        })
        if (!issue) throw new Error('issue not found')

        let issueComment = await Github.addCommentToIssue(octo, {
            owner: args.owner,
            repo: args.repo,
            issueNumber: args.number,
            comment: args.comment,
        })
        if (issueComment.isErr) throw new Error('octo error: failed to add comment')

        await ctx.runMutation(internal.models.issueComments.insertUserComment, {
            repoId: savedRepo._id,
            issueId: issue._id,
            githubId: issueComment.val.id,
            body: args.comment,
            createdAt: issueComment.val.created_at,
            updatedAt: issueComment.val.updated_at,
        })
    },
})
