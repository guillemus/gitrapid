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

export const insertIssuesWithCommentsBatch = protectedMutation({
    args: {
        items: v.array(
            v.object({
                issue: v.object(schemas.issuesSchema),
                body: v.string(),
                comments: v.array(
                    v.object({
                        githubId: v.number(),
                        author: v.object({ login: v.string(), id: v.number() }),
                        body: v.string(),
                        createdAt: v.string(),
                        updatedAt: v.string(),
                    }),
                ),
            }),
        ),
    },
    handler: async (ctx, { items }) => {
        for (let item of items) {
            let issueDoc = await IssuesUtils.getOrCreateIssue(ctx, item.issue)

            if (!issueDoc) continue

            if (item.body) {
                await IssuesUtils.upsertIssueBody(ctx, {
                    issueId: issueDoc._id,
                    body: item.body,
                })
            }

            if (item.comments.length > 0) {
                let docs: UpsertDoc<'issueComments'>[] = []
                for (let c of item.comments) {
                    docs.push({
                        issueId: issueDoc._id,
                        githubId: c.githubId,
                        author: c.author,
                        body: c.body,
                        createdAt: c.createdAt,
                        updatedAt: c.updatedAt,
                    })
                }
                await IssueComments.insertMany(ctx, docs)
            }
        }

        return null
    },
})
