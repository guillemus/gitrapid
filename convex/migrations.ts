import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

// to run:
// $ bun convex run convex/migrations.ts:runIt
// monitoring:
// $ bun convex run --component migrations --watch lib:getStatus
export const runIt = migrations.runner(internal.migrations.main)

export const main = migrations.define({
    table: 'issues',
    migrateOne: async (ctx, doc) => {},
})
