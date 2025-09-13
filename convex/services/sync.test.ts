/// <reference types="vite/client" />

import { internal } from '@convex/_generated/api'
import schema from '@convex/schema'
import { convexTest, type TestConvex } from 'convex-test'
import 'dotenv/config'
import { test } from 'vitest'

async function setup(t: TestConvex<typeof schema>, owner: string, repo: string) {
    const userId = await t.run((ctx) => {
        return ctx.db.insert('users', { name: 'test' })
    })

    await t.mutation(internal.models.pats.upsertForUser, {
        userId,
        token: process.env.GITHUB_TOKEN!,
        scopes: [],
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    })

    let repoId = await t.mutation(internal.models.repos.insertNewRepoForUser, {
        owner,
        repo,
        private: false,
        userId,
    })

    return { userId, repoId }
}

test('check repo', async () => {
    const t = convexTest(schema)
    const { userId, repoId } = await setup(t, 'sst', 'opencode')

    await t.action(internal.services.sync.checkRepo, { repoId, userId })
})

// import workflowComponentSchema from '../../node_modules/@convex-dev/workflow/src/component/schema'
// export const workflowComponentModules = import.meta.glob(
//     '../../node_modules/@convex-dev/workflow/src/component/**/!(*.*.*)*.*s',
// )

// test('sync workflow', async () => {
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
//     })
// })
