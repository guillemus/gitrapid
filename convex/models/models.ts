import type { Doc, Id, TableNames } from '@convex/_generated/dataModel'
import type { MutationCtx } from '@convex/_generated/server'
import { protectedMutation } from '@convex/utils'
import type { WithoutSystemFields } from 'convex/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { IssueComments } from './issueComments'
import { Issues } from './issues'
import { Refs } from './refs'
import { RepoCounts } from './repoCounts'
import { Repos } from './repos'
import { UserRepos } from './userRepos'

export type UpsertDoc<T extends TableNames> = WithoutSystemFields<Doc<T>>

export const RepoUtils = {
    async insertNewRepo(ctx: MutationCtx, newRepo: UpsertDoc<'repos'>, userId: Id<'users'>) {
        let repoId
        let repo = await Repos.getByOwnerAndRepo(ctx, newRepo.owner, newRepo.repo)
        if (repo) {
            repoId = repo._id
        } else {
            repoId = await ctx.db.insert('repos', {
                owner: newRepo.owner,
                repo: newRepo.repo,
                private: newRepo.private,
            })
        }

        await UserRepos.getOrCreate(ctx, userId, repoId)

        await RepoCounts.getOrCreate(ctx, {
            repoId,
            openIssues: 0,
            closedIssues: 0,
            openPullRequests: 0,
            closedPullRequests: 0,
        })

        return await ctx.db.get(repoId)
    },
}

export const IssuesUtils = {
    async getOrCreateIssue(ctx: MutationCtx, args: UpsertDoc<'issues'>) {
        let issue = await Issues.getByRepoAndNumber(ctx, args)
        if (issue) {
            return issue
        }

        let id = await ctx.db.insert('issues', args)

        // Update repo counts on insert
        let counts = await RepoCounts.getByRepoId(ctx, args.repoId)
        if (counts) {
            if (args.state === 'open') {
                await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
            } else {
                await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
            }
        }

        return await ctx.db.get(id)
    },

    async upsertIssue(ctx: MutationCtx, args: UpsertDoc<'issues'>) {
        let existing = await Issues.getByRepoAndNumber(ctx, args)
        if (existing) {
            // Adjust counts if state changed
            if (existing.state !== args.state) {
                let counts = await RepoCounts.getByRepoId(ctx, existing.repoId)
                if (counts) {
                    if (args.state === 'open') {
                        await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
                        await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues - 1)
                    } else {
                        await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues - 1)
                        await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
                    }
                }
            }
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        // Insert new issue and bump counts
        let id = await ctx.db.insert('issues', args)
        let counts = await RepoCounts.getByRepoId(ctx, args.repoId)
        if (counts) {
            if (args.state === 'open') {
                await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
            } else {
                await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
            }
        }
        return await ctx.db.get(id)
    },

    async deleteIssueByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let issues = await Issues.listByRepo(ctx, repoId)
        for (let issue of issues) {
            await IssueComments.deleteByIssueId(ctx, issue._id)
            await ctx.db.delete(issue._id)
        }
    },
}

export async function setRepoHead(ctx: MutationCtx, repoId: Id<'repos'>, headRefName: string) {
    // check first if ref exists
    let ref = await Refs.getByRepoAndName(ctx, repoId, headRefName)
    if (!ref) return null

    return await ctx.db.patch(repoId, { headId: ref._id })
}

export const insertNewRepo = protectedMutation({
    args: {
        userId: v.id('users'),
        ...schemas.reposSchema,
    },
    handler: (ctx, { userId, ...args }) => RepoUtils.insertNewRepo(ctx, args, userId),
})

export const getOrCreateIssue = protectedMutation({
    args: schemas.issuesSchema,
    handler: (ctx, args) => IssuesUtils.getOrCreateIssue(ctx, args),
})

export const upsertIssue = protectedMutation({
    args: schemas.issuesSchema,
    handler: (ctx, args) => IssuesUtils.upsertIssue(ctx, args),
})

export const deleteIssueByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => IssuesUtils.deleteIssueByRepoId(ctx, repoId),
})
