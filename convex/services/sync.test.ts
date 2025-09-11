/// <reference types="vite/client" />

// import { internal } from '@convex/_generated/api'
// import schema from '@convex/schema'
// import { convexTest } from 'convex-test'
// import { test } from 'vitest'

// import workflowComponentSchema from '../../node_modules/@convex-dev/workflow/src/component/schema'
// export const workflowComponentModules = import.meta.glob(
//     '../../node_modules/@convex-dev/workflow/src/component/**/!(*.*.*)*.*s',
// )

// test('sync', async () => {
//     const t = convexTest(schema)
//     t.registerComponent('workflow', workflowComponentSchema, workflowComponentModules)

//     let userId = await t.run((ctx) => {
//         return ctx.db.insert('users', { name: 'test' })
//     })

//     let repoId = await t.mutation(internal.models.repos.insertNewRepoForUser, {
//         owner: 'sst',
//         repo: 'opencode',
//         private: false,
//         userId,
//     })

//     await t.mutation(internal.services.sync.startWorkflow, {
//         userId,
//         repoId,
//         startSync: new Date().toISOString(),
//         backfill: false,
//     })
// })
