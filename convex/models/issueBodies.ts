import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation } from '../utils'
import * as models from './models'

export const IssueBodies = {
    async search(ctx: QueryCtx, repoId: Id<'repos'>, CAP: number, q: string) {
        let matches = await ctx.db
            .query('issueBodies')
            .withSearchIndex('search_issue_bodies', (s) => s.search('body', q).eq('repoId', repoId))
            .take(CAP)
        return matches
    },

    async listByIssueId(ctx: QueryCtx, issueId: Id<'issues'>) {
        return ctx.db
            .query('issueBodies')
            .withIndex('by_issue_id', (q) => q.eq('issueId', issueId))
            .collect()
    },
}
