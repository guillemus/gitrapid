import { customCtx, customMutation } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'
import type { DataModel, Id } from './_generated/dataModel'
import {
    internalMutation as rawInternalMutation,
    mutation as rawMutation,
} from './_generated/server'

const triggers = new Triggers<DataModel>()

triggers.register('issues', async (ctx, change) => {
    async function getRepoCounts(repoId: Id<'repos'>) {
        let repo = await ctx.db.get(repoId)
        if (!repo) return

        let repoCounts = await ctx.db
            .query('repoCounts')
            .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
            .unique()

        return repoCounts
    }

    if (change.operation === 'delete') {
        let repoCounts = await getRepoCounts(change.oldDoc.repoId)
        if (!repoCounts) return

        if (change.oldDoc.state === 'open') {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues - 1,
            })
        } else {
            await ctx.db.patch(repoCounts._id, {
                closedIssues: repoCounts.closedIssues - 1,
            })
        }
    } else if (change.operation === 'insert') {
        let repoCounts = await getRepoCounts(change.newDoc.repoId)
        if (!repoCounts) return

        if (change.newDoc.state === 'open') {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues + 1,
            })
        } else {
            await ctx.db.patch(repoCounts._id, {
                closedIssues: repoCounts.closedIssues + 1,
            })
        }
    } else if (change.operation === 'update') {
        if (change.oldDoc.state === change.newDoc.state) {
            return
        }

        let repoCounts = await getRepoCounts(change.oldDoc.repoId)
        if (!repoCounts) return

        if (change.newDoc.state === 'open') {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues + 1,
                closedIssues: repoCounts.closedIssues - 1,
            })
        } else {
            await ctx.db.patch(repoCounts._id, {
                openIssues: repoCounts.openIssues - 1,
                closedIssues: repoCounts.closedIssues + 1,
            })
        }
    }
})

// All mutations in this app should use these 2 to enforce triggers

export const appMutation = customMutation(rawMutation, customCtx(triggers.wrapDB))
export const appInternalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB))
