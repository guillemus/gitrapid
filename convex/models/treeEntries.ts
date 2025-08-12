import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'
import * as schemas from '../schema'

export const getByRepoAndTreeAndEntry = protectedQuery({
    args: { repoId: v.id('repos'), rootTreeSha: v.string(), path: v.string() },
    handler: (ctx, { repoId, rootTreeSha, path }) =>
        models.TreeEntries.getByRepoAndTreeAndEntry(ctx, repoId, rootTreeSha, path),
})

export const getByRepoAndTree = protectedQuery({
    args: { repoId: v.id('repos'), rootTreeSha: v.string() },
    handler: (ctx, { repoId, rootTreeSha }) =>
        models.TreeEntries.getByRepoAndTree(ctx, repoId, rootTreeSha),
})

export const getOrCreate = protectedMutation({
    args: schemas.treeEntriesSchema,
    handler: (ctx, args) => models.TreeEntries.getOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.TreeEntries.deleteByRepoId(ctx, repoId),
})
