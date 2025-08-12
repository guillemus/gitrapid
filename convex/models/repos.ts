import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'

export const get = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Repos.get(ctx, repoId),
})

export const getByOwnerAndRepo = protectedQuery({
    args: { owner: v.string(), repo: v.string() },
    handler: (ctx, { owner, repo }) => models.Repos.getByOwnerAndRepo(ctx, owner, repo),
})

export const getByOwnerRepo = protectedQuery({
    args: { owner: v.string(), repo: v.string() },
    handler: (ctx, { owner, repo }) => models.Repos.getByOwnerRepo(ctx, owner, repo),
})

export const getOrCreate = protectedMutation({
    args: { owner: v.string(), repo: v.string(), private: v.boolean() },
    handler: (ctx, args) => models.Repos.getOrCreate(ctx, args),
})

export const deleteById = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => models.Repos.deleteById(ctx, repoId),
})

export const setHead = protectedMutation({
    args: { repoId: v.id('repos'), headRefName: v.string() },
    handler: (ctx, args) => models.setRepoHead(ctx, args.repoId, args.headRefName),
})
