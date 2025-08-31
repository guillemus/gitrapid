import { query } from '@convex/_generated/server'
import { IssueBodies } from '@convex/models/issueBodies'
import { IssueComments } from '@convex/models/issueComments'
import { Issues } from '@convex/models/issues'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { IssueSearch } from '@convex/services/issueSearch'
import { getUserId } from '@convex/utils'
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

        let savedRepo = await Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (!savedRepo) return null

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, savedRepo._id)
        if (!hasRepo) return null

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

        let savedRepo = await Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (!savedRepo) return null

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, savedRepo._id)
        if (!hasRepo) return null

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

        let savedRepo = await Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (!savedRepo) return null

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, savedRepo._id)
        if (!hasRepo) return null

        let issue = await Issues.getByRepoAndNumber(ctx, {
            number: args.number,
            repoId: savedRepo._id,
        })
        if (!issue) return null

        let issueBodies = await IssueBodies.listByIssueId(ctx, issue._id)
        let issueComments = await IssueComments.listByIssueId(ctx, issue._id)
        return {
            issue,
            issueBodies,
            issueComments,
        }
    },
})
