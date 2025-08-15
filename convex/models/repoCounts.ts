import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import type { UpsertDoc } from './models'

export const RepoCounts = {
    async getByRepoId(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('repoCounts')
            .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'repoCounts'>) {
        let existing = await this.getByRepoId(ctx, args.repoId)
        if (existing) {
            return existing
        }
        let id = await ctx.db.insert('repoCounts', args)
        return await ctx.db.get(id)
    },

    async setOpenIssues(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { openIssues: count })
    },

    async setClosedIssues(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { closedIssues: count })
    },

    async setOpenPullRequests(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { openPullRequests: count })
    },

    async setClosedPullRequests(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { closedPullRequests: count })
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let existing = await this.getByRepoId(ctx, repoId)
        if (existing) {
            await ctx.db.delete(existing._id)
        }
    },
}
