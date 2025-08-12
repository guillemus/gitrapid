import * as schemas from '@convex/schema'
import { protectedMutation, protectedQuery } from '@convex/utils'
import { v } from 'convex/values'
import * as models from './models'

export const getByRepoAndSha = protectedQuery({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, { repoId, sha }) => models.Blobs.getByRepoAndSha(ctx, repoId, sha),
})

export const getOrCreate = protectedMutation({
    args: schemas.blobsSchema,
    handler: (ctx, args) => models.Blobs.getOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Blobs.deleteByRepoId(ctx, repoId),
})

export const upsert = protectedMutation({
    args: schemas.blobsSchema,
    handler: (ctx, args) => models.Blobs.upsert(ctx, args),
})
