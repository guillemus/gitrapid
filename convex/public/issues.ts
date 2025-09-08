import { api } from '@convex/_generated/api'
import { action, query } from '@convex/_generated/server'
import { IssueBodies } from '@convex/models/issueBodies'
import { IssueComments } from '@convex/models/issueComments'
import { Issues } from '@convex/models/issues'
import { IssueTimelineItems } from '@convex/models/issueTimelineItems'
import { Auth, getTokenFromUserId, getUserId } from '@convex/services/auth'
import { Github, newOctokit } from '@convex/services/github'
import { IssueSearch } from '@convex/services/issueSearch'
import { unwrap } from '@convex/shared'
import { SECRET, logger } from '@convex/utils'
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

        return IssueSearch.search(ctx, savedRepo, args.search)
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

        let issue = await Issues.getByRepoAndNumber(ctx, {
            number: args.number,
            repoId: savedRepo._id,
        })
        if (!issue) return null

        let body = await IssueBodies.getByIssueId(ctx, issue._id)
        let timelineItems = await IssueTimelineItems.listByIssueId(ctx, issue._id)
        let comments = await IssueComments.listByIssueId(ctx, issue._id)

        return {
            issue,
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
        let hasAccess = await ctx.runQuery(api.services.auth.hasUserAccessToRepo, {
            ...SECRET,
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let token = await getTokenFromUserId(ctx, userId)
        if (token.isErr) throw new Error('no PAT found')

        let octo = newOctokit(token.val)

        let issueDoc = await Github.createIssue(
            { octo },
            {
                owner: args.owner,
                repo: args.repo,
                title: args.title,
                body: args.body,
                repoId: savedRepo._id,
            },
        )
        if (issueDoc.isErr) {
            logger.error(`octo error: failed to create issue: ${issueDoc.err}`)
            throw new Error('octo error: failed to create issue')
        }

        await ctx.runMutation(api.models.models.insertIssuesWithCommentsBatch, {
            ...SECRET,
            items: [
                {
                    issue: issueDoc.val,
                    body: args.body,
                    timelineItems: [],
                    comments: [],
                },
            ],
        })

        return { githubIssueNumber: issueDoc.val.number }
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
        let hasAccess = await ctx.runQuery(api.services.auth.hasUserAccessToRepo, {
            ...SECRET,
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let token = await getTokenFromUserId(ctx, userId)
        if (token.isErr) throw new Error('no PAT found')

        let octo = newOctokit(token.val)

        let issue = await ctx.runQuery(api.models.issues.getByRepoAndNumber, {
            ...SECRET,
            repoId: savedRepo._id,
            number: args.number,
        })
        if (!issue) throw new Error('issue not found')

        let issueComment = await Github.addComment(
            { octo },
            {
                owner: args.owner,
                repo: args.repo,
                number: args.number,
                comment: args.comment,
                repoId: savedRepo._id,
                issueId: issue._id,
            },
        )
        if (issueComment.isErr) throw new Error('octo error: failed to add comment')

        await ctx.runMutation(api.models.issueComments.insertMany, {
            ...SECRET,
            comments: [issueComment.val],
        })
    },
})
