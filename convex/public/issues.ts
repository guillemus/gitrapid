import type { Doc, Id } from '@convex/_generated/dataModel'
import { query } from '@convex/_generated/server'
import { Issues } from '@convex/models/issues'
import { Repos } from '@convex/models/repos'
import { UserRepos } from '@convex/models/userRepos'
import { getUserId, logger } from '@convex/utils'
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

export const getWithComments = query({
    args: {
        repoId: v.id('repos'),
        issueNumber: v.number(),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, args.repoId)
        if (!hasRepo) {
            throw new Error('not authorized to these issues')
        }

        let issue = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (i) =>
                i.eq('repoId', args.repoId).eq('number', args.issueNumber),
            )
            .unique()
        if (!issue) {
            logger.info({ userId }, 'No issue found for user')
            return null
        }

        let comments = await ctx.db
            .query('issueComments')
            .withIndex('by_issue', (c) => c.eq('issueId', issue._id))
            .collect()

        return {
            issue,
            comments,
        }
    },
})

// Unified search: fetch up to 200 unique issues matching title or comment bodies.
// No server-side pagination; client paginates/sorts/filters the returned array.
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

        let repoId: Id<'repos'> = savedRepo._id

        let q = args.search.trim()
        if (q.length === 0) {
            return {
                issues: [],
                meta: { total: 0, totalOpen: 0, totalClosed: 0, reachedCap: false },
            }
        }

        let CAP = 50
        let uniqueIds = new Set<Id<'issues'>>()
        let results: Array<Doc<'issues'>> = []

        // fetch top title matches
        let titleMatches = await ctx.db
            .query('issues')
            .withSearchIndex('search_issues', (s) => s.search('title', q).eq('repoId', repoId))
            .take(CAP)
        for (let issue of titleMatches) {
            if (results.length >= CAP) break
            if (!uniqueIds.has(issue._id)) {
                uniqueIds.add(issue._id)
                results.push(issue)
            }
        }

        // fetch top comment matches (more than CAP to account for duplicates per issue)
        let commentMatches = await ctx.db
            .query('issueComments')
            .withSearchIndex('search_issue_comments', (s) =>
                s.search('body', q).eq('repoId', repoId),
            )
            .take(CAP * 2)
        for (let c of commentMatches) {
            if (results.length >= CAP) break
            let id = c.issueId as Id<'issues'>
            if (!uniqueIds.has(id)) {
                let issue = await ctx.db.get(id)
                if (issue) {
                    uniqueIds.add(id)
                    results.push(issue)
                }
            }
        }

        // counts based on fetched set
        let openCount = 0
        let closedCount = 0
        for (let it of results) {
            if (it.state === 'open') openCount++
            else if (it.state === 'closed') closedCount++
        }

        let reachedCap = results.length >= CAP

        return {
            issues: results,
            meta: {
                total: results.length,
                totalOpen: openCount,
                totalClosed: closedCount,
                reachedCap,
            },
        }
    },
})
