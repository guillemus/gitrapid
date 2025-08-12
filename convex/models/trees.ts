import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'

export const getByRepoAndSha = protectedQuery({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, { repoId, sha }) => models.Trees.getByRepoAndSha(ctx, repoId, sha),
})

export const getOrCreate = protectedMutation({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, args) => models.Trees.getOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Trees.deleteByRepoId(ctx, repoId),
})
