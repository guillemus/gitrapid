import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'
import * as schemas from '../schema'

export const getByRepoId = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.RepoDownloadStatus.getByRepoId(ctx, repoId),
})

export const getOrCreate = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.RepoDownloadStatus.getOrCreate(ctx, repoId),
})

export const upsert = protectedMutation({
    args: schemas.repoDownloadStatusSchema,
    handler: (ctx, args) => models.RepoDownloadStatus.upsert(ctx, args),
})
