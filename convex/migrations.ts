import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

// Migration to delete all issue comments
export const deleteAllIssueComments = migrations.define({
    table: 'issueComments',
    parallelize: true,
    batchSize: 500,
    migrateOne: async (ctx, doc) => {
        await ctx.db.delete(doc._id)
    },
})
