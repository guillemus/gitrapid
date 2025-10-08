import { internal } from '@convex/_generated/api'
import { internalAction, mutation, query } from '@convex/_generated/server'
import { IssueBodies } from '@convex/models/issueBodies'
import { IssueComments } from '@convex/models/issueComments'
import { Issues } from '@convex/models/issues'
import { IssueTimelineItems } from '@convex/models/issueTimelineItems'
import { PATs } from '@convex/models/pats'
import { Auth, canUserCommentOnRepo } from '@convex/services/auth'
import { Github, newOctokit } from '@convex/services/github'
import { octoFromUserId } from '@convex/services/sync'
import { err, ok, unwrap } from '@convex/shared'
import { logger } from '@convex/utils'
import { assert } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const list = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        state: v.union(v.literal('open'), v.literal('closed')),
        sortBy: v.optional(
            v.union(v.literal('createdAt'), v.literal('updatedAt'), v.literal('comments')),
        ),
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo.handler(ctx, {
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let result = await Issues.paginate.handler(ctx, {
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

export const getById = query({
    args: {
        issueId: v.id('issues'),
    },
    handler(ctx, args) {
        return ctx.db.get(args.issueId)
    },
})

export const get = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        number: v.number(),
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo.handler(ctx, {
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

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

export const create = mutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        title: v.string(),
        body: v.string(),
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo.handler(ctx, {
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let pat = await PATs.getByUserId.handler(ctx, { userId })
        if (!pat) return err('PAT_NOT_FOUND')

        let githubUser = await ctx.db.get(pat.githubUser)
        assert(githubUser, 'github user not found')

        let issueId = await Issues.insertOpenUserIssueWithBody.handler(ctx, {
            userGithubId: githubUser.githubId,
            repoId: savedRepo._id,
            title: args.title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // we don't have yet neither of these, so -2123 is enough of a strange id
            // to be greppable against this codebase. If disaster happens we can traceback
            // the error to here.
            githubId: -2123,
            number: -2123,
            body: args.body,
        })

        await ctx.scheduler.runAfter(0, internal.public.issues.createAction, {
            owner: args.owner,
            repo: args.repo,
            title: args.title,
            body: args.body,
            userId,
            issueId,
        })

        return ok(issueId)
    },
})

export const createAction = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
        title: v.string(),
        body: v.string(),
        userId: v.id('users'),
        issueId: v.id('issues'),
    },
    async handler(ctx, args): Promise<void> {
        let octo = await octoFromUserId(ctx, args.userId)

        let rollback = () =>
            ctx.runMutation(internal.models.issues.doDelete, { issueId: args.issueId })

        if (octo.isErr) {
            logger.error(`octo error: failed to get octo: ${octo.err}`)
            await rollback()
            return
        }

        let created = await Github.createIssue(octo.val, args)
        if (created.isErr) {
            logger.error(`octo error: failed to create issue: ${created.err}`)
            await rollback()
            return
        }

        await ctx.runMutation(internal.models.issues.update, {
            issueId: args.issueId,
            createdAt: created.val.created_at,
            updatedAt: created.val.updated_at,
            githubId: created.val.id,
            number: created.val.number,
        })
    },
})

export const addComment = mutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        number: v.number(),
        comment: v.string(),
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo.handler(ctx, {
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let token
        token = await PATs.getByUserId.handler(ctx, { userId })
        if (!token) return err({ type: 'PAT_NOT_FOUND' })

        let githubUser = await ctx.db.get(token.githubUser)
        assert(githubUser, 'github user not found')

        if (!canUserCommentOnRepo(savedRepo, token)) {
            if (savedRepo.private) {
                return err({ type: 'INSUFFICIENT_SCOPES', requiredScope: 'repo' })
            }
        }

        let issue = await Issues.getByRepoAndNumber.handler(ctx, {
            repoId: savedRepo._id,
            number: args.number,
        })
        assert(issue, 'issue not found')

        let commentId = await ctx.runMutation(internal.models.issueComments.insertUserComment, {
            repoId: savedRepo._id,
            githubUserId: githubUser.githubId,
            issueId: issue._id,
            githubId: -2134,
            body: args.comment,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        // schedule here the comment creation

        await ctx.scheduler.runAfter(0, internal.public.issues.addCommentAction, {
            owner: args.owner,
            repo: args.repo,
            token: token.token,
            comment: args.comment,
            issueNumber: args.number,
            commentId,
        })

        return ok()
    },
})

export const addCommentAction = internalAction({
    args: {
        token: v.string(),
        owner: v.string(),
        repo: v.string(),
        issueNumber: v.number(),
        comment: v.string(),
        commentId: v.id('issueComments'),
    },
    async handler(ctx, args) {
        let octo = newOctokit(args)

        let rollback = () =>
            ctx.runMutation(internal.models.issues.deleteComment, { commentId: args.commentId })

        let issueComment = await Github.addCommentToIssue(octo, {
            owner: args.owner,
            repo: args.repo,
            issueNumber: args.issueNumber,
            comment: args.comment,
        })
        if (issueComment.isErr) {
            logger.error(`octo error: failed to add comment: ${issueComment.err}`)
            await rollback()
            return
        }

        await ctx.runMutation(internal.models.issueComments.updateCommentFromGithubData, {
            commentId: args.commentId,
            githubId: issueComment.val.id,
            createdAt: issueComment.val.created_at,
            updatedAt: issueComment.val.updated_at,
        })
    },
})

export const editTitle = mutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        issueNumber: v.number(),
        newTitle: v.string(),
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)
        let hasAccess = await Auth.hasUserAccessToRepo.handler(ctx, {
            userId,
            owner: args.owner,
            repo: args.repo,
        })
        let savedRepo = unwrap(hasAccess)

        let issue = await Issues.getByRepoAndNumber.handler(ctx, {
            repoId: savedRepo._id,
            number: args.issueNumber,
        })
        assert(issue, 'issue not found')

        let prevTitle = issue.title

        await Issues.updateTitle.handler(ctx, {
            issueId: issue._id,
            title: args.newTitle,
        })

        await ctx.scheduler.runAfter(0, internal.public.issues.editTitleAction, {
            owner: args.owner,
            repo: args.repo,
            userId,
            issueId: issue._id,
            issueNumber: args.issueNumber,
            prevTitle,
            newTitle: args.newTitle,
        })
    },
})

export const editTitleAction = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
        userId: v.id('users'),
        issueId: v.id('issues'),
        issueNumber: v.number(),
        prevTitle: v.string(),
        newTitle: v.string(),
    },
    async handler(ctx, args) {
        let octo = await octoFromUserId(ctx, args.userId)
        if (octo.isErr) {
            logger.error(`octo error: failed to get octo: ${octo.err}`)
            await ctx.runMutation(internal.models.issues.updateTitle, {
                issueId: args.issueId,
                title: args.prevTitle,
            })
            return
        }

        let issue = await Github.editIssueTitle(octo.val, {
            owner: args.owner,
            repo: args.repo,
            issueNumber: args.issueNumber,
            title: args.newTitle,
        })
        if (issue.isErr) {
            logger.error(`octo error: failed to edit issue title: ${issue.err}`)
            return
        }

        await ctx.runMutation(internal.models.issues.updateTitle, {
            issueId: args.issueId,
            title: args.prevTitle,
        })
    },
})
