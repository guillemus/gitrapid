import { customCtx, customMutation } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'
import type { DataModel } from './_generated/dataModel'
import {
    internalMutation as rawInternalMutation,
    mutation as rawMutation,
} from './_generated/server'
import { RepoCounts } from './models/models'

// fixme: I can just delete this and handle on the models.ts layer instead

const triggers = new Triggers<DataModel>()

triggers.register('issues', async (ctx, change) => {
    if (change.operation === 'delete') {
        let counts = await RepoCounts.getByRepoId(ctx, change.oldDoc.repoId)
        if (!counts) return

        if (change.oldDoc.state === 'open') {
            await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues - 1)
        } else {
            await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues - 1)
        }
    } else if (change.operation === 'insert') {
        let counts = await RepoCounts.getByRepoId(ctx, change.newDoc.repoId)
        if (!counts) return

        if (change.newDoc.state === 'open') {
            await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
        } else {
            await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
        }
    } else if (change.operation === 'update') {
        if (change.oldDoc.state === change.newDoc.state) {
            return
        }

        let counts = await RepoCounts.getByRepoId(ctx, change.oldDoc.repoId)
        if (!counts) return

        if (change.newDoc.state === 'open') {
            await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
            await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues - 1)
        } else {
            await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues - 1)
            await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
        }
    }
})

// All mutations in this app should use these 2 to enforce triggers

export const appMutation = customMutation(rawMutation, customCtx(triggers.wrapDB))
export const appInternalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB))
