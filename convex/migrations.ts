import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

// to run:
//  - start from 0
// $ bun convex run convex/migrations.ts:runIt '{cursor: null}'
//  - start (failed one maybe??)
// $ bun convex run convex/migrations.ts:runIt
// monitoring:
// $ bun convex run --component migrations --watch lib:getStatus
export const runIt = migrations.runner(internal.migrations.main)

export const main = migrations.define({
    table: 'repos',
    migrateOne: async (_ctx, _doc) => {},
})
