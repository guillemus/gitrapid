import { internal } from '@convex/_generated/api'
import { internalAction, mutation, query } from '@convex/_generated/server'
import { IssueBodies } from '@convex/models/issueBodies'
import { IssueComments } from '@convex/models/issueComments'
import { Issues } from '@convex/models/issues'
import { IssueTimelineItems } from '@convex/models/issueTimelineItems'
import { Auth, canUserCommentOnRepo } from '@convex/services/auth'
import { Github, newOctokit } from '@convex/services/github'
import { err, ok, unwrap, wrap } from '@convex/shared'
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
        let user = await Auth.getUserWithTokenAndAssociatedRepo(ctx, args.owner, args.repo)
        assert(!user.isErr, 'failed to get user with token')

        let savedRepo = user.val.userRepo

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
        let userRepo = await Auth.getUserAssociatedRepo.handler(ctx, {
            userId,
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

let createArgs = v.object({
    owner: v.string(),
    repo: v.string(),
    title: v.string(),
    body: v.string(),
})

export const create = mutation({
    args: createArgs,
    async handler(ctx, args) {
        let user = await Auth.getUserWithTokenAndAssociatedRepo(ctx, args.owner, args.repo)
        if (user.isErr) {
            return wrap('Failed to get user with token', user)
        }

        let savedRepo = user.val.userRepo

        let githubUser = await ctx.db.get(user.val.pat.githubUser)
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
            args,
            token: user.val.pat.token,
            userId: user.val.userId,
            issueId,
        })

        return ok(issueId)
    },
})

export const createAction = internalAction({
    args: {
        args: createArgs,
        token: v.string(),
        userId: v.id('users'),
        issueId: v.id('issues'),
    },
    async handler(ctx, args): Promise<void> {
        let octo = newOctokit(args)

        let rollback = () =>
            ctx.runMutation(internal.models.issues.doDelete, { issueId: args.issueId })

        let created = await Github.createIssue(octo, args.args)
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

let addCommentArgs = v.object({
    owner: v.string(),
    repo: v.string(),
    issueNumber: v.number(),
    comment: v.string(),
})

export const addComment = mutation({
    args: addCommentArgs,
    async handler(ctx, args) {
        let user = await Auth.getUserWithTokenAndAssociatedRepo(ctx, args.owner, args.repo)
        assert(!user.isErr, 'failed to get user with token')

        let savedRepo = user.val.userRepo
        if (!canUserCommentOnRepo(savedRepo, user.val.pat)) {
            if (savedRepo.private) {
                return err({ type: 'INSUFFICIENT_SCOPES', requiredScope: 'repo' })
            }
        }

        let githubUser = await ctx.db.get(user.val.pat.githubUser)
        assert(githubUser, 'github user not found')

        let issue = await Issues.getByRepoAndNumber.handler(ctx, {
            repoId: savedRepo._id,
            number: args.issueNumber,
        })
        assert(issue, 'issue not found')

        let commentId = await ctx.runMutation(internal.models.issueComments.insertUserComment, {
            repoId: savedRepo._id,
            githubUserId: githubUser.githubId,
            body: args.comment,
            issueId: issue._id,
            githubId: -2134,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        await ctx.scheduler.runAfter(0, internal.public.issues.addCommentAction, {
            args,
            token: user.val.pat.token,
            commentId,
        })

        return ok()
    },
})

export const addCommentAction = internalAction({
    args: {
        args: addCommentArgs,
        token: v.string(),
        commentId: v.id('issueComments'),
    },
    async handler(ctx, args) {
        let octo = newOctokit(args)

        let rollback = () =>
            ctx.runMutation(internal.models.issues.deleteComment, { commentId: args.commentId })

        let issueComment = await Github.addCommentToIssue(octo, args.args)
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

let editTitleArgs = v.object({
    owner: v.string(),
    repo: v.string(),
    issueNumber: v.number(),
    newTitle: v.string(),
})

export const editTitle = mutation({
    args: editTitleArgs,
    async handler(ctx, args) {
        let user = await Auth.getUserWithTokenAndAssociatedRepo(ctx, args.owner, args.repo)
        if (user.isErr) {
            return wrap('Failed to get user with token', user)
        }

        let issue = await Issues.getByRepoAndNumber.handler(ctx, {
            repoId: user.val.userRepo._id,
            number: args.issueNumber,
        })
        assert(issue, 'issue not found')

        let prevTitle = issue.title

        await Issues.updateTitle.handler(ctx, {
            issueId: issue._id,
            title: args.newTitle,
        })

        await ctx.scheduler.runAfter(0, internal.public.issues.editTitleAction, {
            args,
            token: user.val.pat.token,
            userId: user.val.userId,
            issueId: issue._id,
            prevTitle,
        })
    },
})

export const editTitleAction = internalAction({
    args: {
        args: editTitleArgs,
        token: v.string(),
        userId: v.id('users'),
        issueId: v.id('issues'),
        prevTitle: v.string(),
    },
    async handler(ctx, args) {
        let octo = newOctokit(args)

        let issue = await Github.editIssueTitle(octo, {
            owner: args.args.owner,
            repo: args.args.repo,
            issueNumber: args.args.issueNumber,
            title: args.args.newTitle,
        })
        if (issue.isErr) {
            logger.error(`octo error: failed to edit issue title: ${issue.err}`)
            await ctx.runMutation(internal.models.issues.updateTitle, {
                issueId: args.issueId,
                title: args.prevTitle,
            })
            return
        }
    },
})
