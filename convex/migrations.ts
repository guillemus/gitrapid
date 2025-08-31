import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()
export const runIt = migrations.runner(internal.migrations.backfillIssueBodiesRepoId)

// Backfill repoId on issueBodies from linked issue
export const backfillIssueBodiesRepoId = migrations.define({
    table: 'issueBodies',
    migrateOne: async (ctx, doc) => {
        if (doc.repoId) return

        let issue = await ctx.db.get(doc.issueId)
        if (!issue) {
            await ctx.db.delete(doc._id)
            return
        }

        await ctx.db.patch(doc._id, { repoId: issue.repoId })
    },
})
