import type { Id } from '@convex/_generated/dataModel'
import { type QueryCtx } from '@convex/_generated/server'

export const IssueBodies = {
    async search(ctx: QueryCtx, repoId: Id<'repos'>, q: string) {
        let matches = await ctx.db
            .query('issueBodies')
            .withSearchIndex('search_issue_bodies', (s) => s.search('body', q).eq('repoId', repoId))
            .collect()
        return matches
    },

    async getByIssueId(ctx: QueryCtx, issueId: Id<'issues'>) {
        return ctx.db
            .query('issueBodies')
            .withIndex('by_issue_id', (q) => q.eq('issueId', issueId))
            .unique()
    },
}
