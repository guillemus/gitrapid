import type { Doc, Id } from '@convex/_generated/dataModel'
import type { QueryCtx } from '@convex/_generated/server'
import { IssueBodies } from '@convex/models/issueBodies'
import { IssueComments } from '@convex/models/issueComments'
import { addAuthorsToIssues, addLabelsToIssues, Issues } from '@convex/models/issues'

// @ts-expect-error: remove console.time

const CAP = 100

export const IssueSearch = {
    search: searchIssues,
}

async function searchIssues(ctx: QueryCtx, savedRepo: Doc<'repos'>, search: string) {
    let repoId: Id<'repos'> = savedRepo._id

    search = search.trim()
    if (search.length === 0) {
        return {
            issues: [],
            meta: { total: 0, totalOpen: 0, totalClosed: 0, reachedCap: false },
        }
    }

    let results: Map<Id<'issues'>, Doc<'issues'>> = new Map()

    let titleMatches = await Issues.search(ctx, repoId, CAP, search)
    for (let issue of titleMatches) {
        results.set(issue._id, issue)
    }

    let commentMatches = await IssueComments.search(ctx, repoId, CAP, search)
    for (let c of commentMatches) {
        let id = c.issueId as Id<'issues'>
        if (!results.has(id)) {
            let issue = await ctx.db.get(id)
            if (issue) {
                results.set(id, issue)
            }
        }
    }

    let bodyMatches = await IssueBodies.search(ctx, repoId, CAP, search)
    for (let b of bodyMatches) {
        let id = b.issueId as Id<'issues'>
        if (!results.has(id)) {
            let issue = await ctx.db.get(id)
            if (issue) {
                results.set(id, issue)
            }
        }
    }

    let openCount = 0
    let closedCount = 0
    for (let it of results.values()) {
        if (it.state === 'open') openCount++
        else if (it.state === 'closed') closedCount++
    }

    let reachedCap = results.size >= CAP

    let issues = Array.from(results.values())
    let issuesWithLabels = await addLabelsToIssues(ctx, issues, repoId)
    let issuesWithAuthor = await addAuthorsToIssues(ctx, issuesWithLabels)

    return {
        issues: issuesWithAuthor,
        meta: {
            total: results.size,
            totalOpen: openCount,
            totalClosed: closedCount,
            reachedCap,
        },
    }
}
