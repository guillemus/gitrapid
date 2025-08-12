import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'
import * as schemas from '../schema'

export const get = protectedQuery({
    args: { refId: v.id('refs') },
    handler: (ctx, { refId }) => models.Refs.get(ctx, refId),
})

export const getByRepoAndName = protectedQuery({
    args: { repoId: v.id('repos'), name: v.string() },
    handler: (ctx, { repoId, name }) => models.Refs.getByRepoAndName(ctx, repoId, name),
})

export const getByRepoAndCommit = protectedQuery({
    args: { repoId: v.id('repos'), commitSha: v.string() },
    handler: (ctx, { repoId, commitSha }) => models.Refs.getByRepoAndCommit(ctx, repoId, commitSha),
})

export const getRefsFromRepo = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Refs.getRefsFromRepo(ctx, repoId),
})

export const upsertMany = protectedMutation({
    args: {
        refs: v.array(v.object(schemas.refsSchema)),
    },
    handler: (ctx, { refs }) => models.Refs.upsertMany(ctx, refs),
})

export const replaceRepoRefs = protectedMutation({
    args: {
        repoId: v.id('repos'),
        refs: v.array(v.object(schemas.refsSchema)),
    },
    handler: (ctx, { repoId, refs }) => models.Refs.replaceRepoRefs(ctx, repoId, refs),
})

export const getOrCreate = protectedMutation({
    args: schemas.refsSchema,
    handler: (ctx, args) => models.Refs.getOrCreate(ctx, args),
})

export const patchOrCreate = protectedMutation({
    args: schemas.refsSchema,
    handler: (ctx, args) => models.Refs.patchOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Refs.deleteByRepoId(ctx, repoId),
})
