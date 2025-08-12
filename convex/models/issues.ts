import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'

export const getByRepoAndNumber = protectedQuery({
    args: { repoId: v.id('repos'), number: v.number() },
    handler: (ctx, { repoId, number }) => models.Issues.getByRepoAndNumber(ctx, { repoId, number }),
})

export const listByRepo = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Issues.listByRepo(ctx, repoId),
})

export const getOrCreate = protectedMutation({
    args: schemas.issuesSchema,
    handler: (ctx, args) => models.Issues.getOrCreate(ctx, args),
})

export const upsert = protectedMutation({
    args: schemas.issuesSchema,
    handler: (ctx, args) => models.Issues.upsert(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Issues.deleteByRepoId(ctx, repoId),
})
