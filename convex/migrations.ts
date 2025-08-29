import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()
export const runIt = migrations.runner(internal.migrations.backfillIssueCommentsRepoId)

export const backfillIssueCommentsRepoId = migrations.define({
    table: 'issueComments',
    migrateOne: async (ctx, doc) => {
        if (doc.repoId) return
        let issue = await ctx.db.get(doc.issueId)
        if (!issue) return
        await ctx.db.patch(doc._id, { repoId: issue.repoId })
    },
})
