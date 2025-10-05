import type { Doc, Id } from '@convex/_generated/dataModel'
import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import { logger, type FnArgs } from '@convex/utils'
import { assert, asyncMap } from 'convex-helpers'
import { v } from 'convex/values'
import { fetchGithubUser } from './issueTimelineItems'

export namespace Issues {
    export const getByRepoAndNumber = {
        args: { repoId: v.id('repos'), number: v.number() },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            return ctx.db
                .query('issues')
                .withIndex('by_repo_and_number', (q) =>
                    q.eq('repoId', args.repoId).eq('number', args.number),
                )
                .unique()
        },
    }

    export const getByRepoAndNumberWithRelations = {
        args: { repoId: v.id('repos'), number: v.number() },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            let issue = await getByRepoAndNumber.handler(ctx, args)
            if (!issue) return null

            let issueAuthor = await fetchGithubUser(ctx, logger, issue.author)

            return {
                ...issue,
                author: issueAuthor,
            }
        },
    }

    export const listByRepo = {
        args: { repoId: v.id('repos') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            return ctx.db
                .query('issues')
                .withIndex('by_repo_and_number', (q) => q.eq('repoId', args.repoId))
                .collect()
        },
    }

    export const search = {
        args: { repoId: v.id('repos'), q: v.string() },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            let issues = await ctx.db
                .query('issues')
                .withSearchIndex('search_issues', (s) =>
                    s.search('title', args.q).eq('repoId', args.repoId),
                )
                .collect()

            let openCount = 0
            let closedCount = 0
            for (let it of issues) {
                if (it.state === 'open') openCount++
                else if (it.state === 'closed') closedCount++
            }

            let issuesWithLabels = await addLabelsToIssues(ctx, issues, args.repoId)
            let issuesWithAuthor = await addAuthorsToIssues(ctx, issuesWithLabels)

            return {
                issues: issuesWithAuthor,
                meta: {
                    total: issues.length,
                    totalOpen: openCount,
                    totalClosed: closedCount,
                },
            }
        },
    }

    export const paginate = {
        args: {
            repoId: v.id('repos'),
            state: v.optional(v.union(v.literal('open'), v.literal('closed'))),
            sortBy: v.optional(
                v.union(v.literal('createdAt'), v.literal('updatedAt'), v.literal('comments')),
            ),
            paginationOpts: v.object({
                numItems: v.number(),
                cursor: v.union(v.string(), v.null()),
            }),
        },
        async paginate(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            let sortBy = args.sortBy ?? 'createdAt'

            // No search term; choose index based on sort and whether state filter is present
            if (args.state) {
                let issueState = args.state

                if (sortBy === 'createdAt') {
                    return ctx.db
                        .query('issues')
                        .withIndex('by_repo_state_createdAt', (q) =>
                            q.eq('repoId', args.repoId).eq('state', issueState),
                        )
                        .order('desc')
                        .paginate(args.paginationOpts)
                }

                if (sortBy === 'updatedAt') {
                    return ctx.db
                        .query('issues')
                        .withIndex('by_repo_state_updatedAt', (q) =>
                            q.eq('repoId', args.repoId).eq('state', issueState),
                        )
                        .order('desc')
                        .paginate(args.paginationOpts)
                }

                if (sortBy === 'comments') {
                    return ctx.db
                        .query('issues')
                        .withIndex('by_repo_state_comments', (q) =>
                            q.eq('repoId', args.repoId).eq('state', issueState),
                        )
                        .order('desc')
                        .paginate(args.paginationOpts)
                }

                // default to number order when explicitly requested or fallback
                return ctx.db
                    .query('issues')
                    .withIndex('by_repo_state_number', (q) =>
                        q.eq('repoId', args.repoId).eq('state', issueState),
                    )
                    .order('desc')
                    .paginate(args.paginationOpts)
            }

            // No state filter
            if (sortBy === 'createdAt') {
                return ctx.db
                    .query('issues')
                    .withIndex('by_repo_createdAt', (q) => q.eq('repoId', args.repoId))
                    .order('desc')
                    .paginate(args.paginationOpts)
            }

            if (sortBy === 'updatedAt') {
                return ctx.db
                    .query('issues')
                    .withIndex('by_repo_updatedAt', (q) => q.eq('repoId', args.repoId))
                    .order('desc')
                    .paginate(args.paginationOpts)
            }

            if (sortBy === 'comments') {
                return ctx.db
                    .query('issues')
                    .withIndex('by_repo_comments', (q) => q.eq('repoId', args.repoId))
                    .order('desc')
                    .paginate(args.paginationOpts)
            }

            // default to number
            return ctx.db
                .query('issues')
                .withIndex('by_repo_and_number', (q) => q.eq('repoId', args.repoId))
                .order('desc')
                .paginate(args.paginationOpts)
        },

        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            let issuesPagination = await this.paginate(ctx, args)
            let issuesWithLabels = await addLabelsToIssues(ctx, issuesPagination.page, args.repoId)
            let issuesWithAuthors = await addAuthorsToIssues(ctx, issuesWithLabels)

            return {
                ...issuesPagination,
                page: issuesWithAuthors,
            }
        },
    }

    export const getAssigneesByIssueId = {
        args: { issueId: v.id('issues') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            let issueAssignees = await ctx.db
                .query('issueAssignees')
                .withIndex('by_issue_id', (q) => q.eq('issueId', args.issueId))
                .collect()

            let assignees = await asyncMap(issueAssignees, async (issueAssignee) => {
                return ctx.db.get(issueAssignee.assigneeId)
            })

            return assignees.filter((a) => a !== null)
        },
    }

    export const getLabelsByIssueId = {
        args: { issueId: v.id('issues') },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this.args>) {
            let issueLabels = await ctx.db
                .query('issueLabels')
                .withIndex('by_issue_id', (q) => q.eq('issueId', args.issueId))
                .collect()

            let labels = await asyncMap(issueLabels, async (issueLabel) => {
                return ctx.db.get(issueLabel.labelId)
            })

            return labels.filter((l) => l !== null)
        },
    }

    export const updateTitle = {
        args: { issueId: v.id('issues'), title: v.string() },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
            await ctx.db.patch(args.issueId, { title: args.title })
        },
    }

    export const doDelete = {
        args: { issueId: v.id('issues') },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
            await ctx.db.delete(args.issueId)
        },
    }

    export const updateIssue = {
        args: {
            issueId: v.id('issues'),
            createdAt: v.string(),
            updatedAt: v.string(),
            githubId: v.number(),
            number: v.number(),
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
            await ctx.db.patch(args.issueId, {
                createdAt: args.createdAt,
                updatedAt: args.updatedAt,
                githubId: args.githubId,
                number: args.number,
            })
        },
    }

    export const insertOpenUserIssueWithBody = {
        args: {
            repoId: v.id('repos'),
            githubId: v.number(),
            number: v.number(),
            title: v.string(),
            createdAt: v.string(),
            updatedAt: v.string(),
            closedAt: v.optional(v.string()),
            comments: v.optional(v.number()),
            body: v.string(),
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
            let useridentity = await ctx.auth.getUserIdentity()
            let githubUserId = useridentity?.subject
            assert(githubUserId, 'not authenticated')

            let githubUserIdNum = parseInt(githubUserId)

            let ghUser = await ctx.db
                .query('githubUsers')
                .withIndex('by_githubId', (u) => u.eq('githubId', githubUserIdNum))
                .unique()
            assert(ghUser, 'github user not found')

            let issueId = await ctx.db.insert('issues', {
                author: ghUser._id,
                createdAt: args.createdAt,
                githubId: args.githubId,
                number: args.number,
                repoId: args.repoId,
                title: args.title,
                state: 'open',
                updatedAt: args.updatedAt,
            })
            await ctx.db.insert('issueBodies', {
                repoId: args.repoId,
                issueId: issueId,
                body: args.body,
            })

            return issueId
        },
    }
}

export const getByRepoAndNumber = internalQuery(Issues.getByRepoAndNumber)
export const listByRepo = internalQuery(Issues.listByRepo)
export const updateTitle = internalMutation(Issues.updateTitle)
export const update = internalMutation(Issues.updateIssue)
export const doDelete = internalMutation(Issues.doDelete)

async function addAuthorsToIssues<T extends Doc<'issues'>>(ctx: QueryCtx, issues: T[]) {
    return asyncMap(issues, async (issue) => {
        let author = await fetchGithubUser(ctx, logger, issue.author)
        let i = issue as Omit<T, 'author'>
        return { ...i, author }
    })
}

async function addLabelsToIssues(ctx: QueryCtx, issues: Doc<'issues'>[], repoId: Id<'repos'>) {
    let repoLabels = await ctx.db
        .query('labels')
        .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
        .collect()

    return asyncMap(issues, async (issue) => {
        let issueLabels = await ctx.db
            .query('issueLabels')
            .withIndex('by_issue_id', (q) => q.eq('issueId', issue._id))
            .collect()

        let labels = []
        for (let issueLabel of issueLabels) {
            let label = repoLabels.find((l) => l._id === issueLabel.labelId)
            if (label) {
                labels.push(label)
            }
        }

        return { ...issue, labels }
    })
}

export const insertOpenUserIssueWithBody = internalMutation(Issues.insertOpenUserIssueWithBody)

export const AssignUserToIssue = {
    args: {
        issueId: v.id('issues'),
        githubId: v.number(),
        login: v.string(),
        avatarUrl: v.string(),
    },
    async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
        let githubUserId: Id<'githubUsers'>
        let githubUser = await ctx.db
            .query('githubUsers')
            .withIndex('by_githubId', (u) => u.eq('githubId', args.githubId))
            .unique()
        if (githubUser) {
            await ctx.db.patch(githubUser._id, {
                login: args.login,
                avatarUrl: args.avatarUrl,
            })
            githubUserId = githubUser._id
        } else {
            githubUserId = await ctx.db.insert('githubUsers', {
                githubId: args.githubId,
                login: args.login,
                avatarUrl: args.avatarUrl,
            })
        }

        let currAssignees = await ctx.db
            .query('issueAssignees')
            .withIndex('by_issue_id', (q) => q.eq('issueId', args.issueId))
            .collect()
        let isAssigned = currAssignees.some((a) => a.assigneeId === githubUserId)
        if (!isAssigned) {
            await ctx.db.insert('issueAssignees', {
                issueId: args.issueId,
                assigneeId: githubUserId,
            })
        }
    },
}

export const AssignLabelToIssue = {
    args: {
        repoId: v.id('repos'),
        issueId: v.id('issues'),
        githubId: v.string(),
        name: v.string(),
        color: v.string(),
    },
    async handler(ctx: MutationCtx, args: FnArgs<typeof this.args>) {
        let labelId: Id<'labels'>
        let repoLabels = await ctx.db
            .query('labels')
            .withIndex('by_repoId', (l) => l.eq('repoId', args.repoId))
            .collect()
        let currLabel = repoLabels.find((l) => l.githubId === args.githubId)
        if (currLabel) {
            await ctx.db.patch(currLabel._id, {
                name: args.name,
                color: args.color,
            })
            labelId = currLabel._id
        } else {
            labelId = await ctx.db.insert('labels', {
                repoId: args.repoId,
                githubId: args.githubId,
                name: args.name,
                color: args.color,
            })
        }

        let currLabels = await ctx.db
            .query('issueLabels')
            .withIndex('by_issue_id', (q) => q.eq('issueId', args.issueId))
            .collect()
        let isLabeled = currLabels.some((l) => l.labelId === labelId)
        if (!isLabeled) {
            await ctx.db.insert('issueLabels', {
                issueId: args.issueId,
                labelId: labelId,
            })
        }
    },
}
