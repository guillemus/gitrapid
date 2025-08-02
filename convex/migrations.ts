import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'
import type { DataModel, Id } from './_generated/dataModel'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

export const migrateThething = migrations.define({
    table: 'installations',
    migrateOne: async (ctx, doc) => {
        await ctx.db.patch(doc._id, { userId: `mx7c2fh3qjpfxnrp3y4trfsx597mhywc` as Id<'users'> })
    },
})
