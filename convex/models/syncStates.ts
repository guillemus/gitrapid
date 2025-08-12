import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'
import * as schemas from '../schema'

export const getByRepoId = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.SyncStates.getByRepoId(ctx, repoId),
})

export const getOrCreate = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.SyncStates.getOrCreate(ctx, { repoId }),
})

export const upsert = protectedMutation({
    args: schemas.syncStatesSchema,
    handler: (ctx, args) => models.SyncStates.upsert(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.SyncStates.deleteByRepoId(ctx, repoId),
})
