import * as schemas from '@convex/schema'
import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'

export const getByUserIdAndRepoId = protectedQuery({
    args: { userId: v.id('users'), repoId: v.id('repos') },
    handler: (ctx, { userId, repoId }) =>
        models.Installations.getByUserIdAndRepoId(ctx, userId, repoId),
})

export const listUserInstallations = protectedQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => models.Installations.listUserInstallations(ctx, userId),
})

export const getByGithubInstallationId = protectedQuery({
    args: { githubInstallationId: v.number() },
    handler: (ctx, { githubInstallationId }) =>
        models.Installations.getByGithubInstallationId(ctx, githubInstallationId),
})

export const getOrCreate = protectedMutation({
    args: schemas.installationsSchema,
    handler: (ctx, args) => models.Installations.getOrCreate(ctx, args),
})

export const upsert = protectedMutation({
    args: schemas.installationsSchema,
    handler: (ctx, args) => models.Installations.upsert(ctx, args),
})

export const deleteByUserAndRepo = protectedMutation({
    args: { userId: v.id('users'), repoId: v.id('repos') },
    handler: (ctx, { userId, repoId }) =>
        models.Installations.deleteByUserAndRepo(ctx, userId, repoId),
})

export const setSuspendedByUserAndRepo = protectedMutation({
    args: { userId: v.id('users'), repoId: v.id('repos'), suspended: v.boolean() },
    handler: (ctx, { userId, repoId, suspended }) =>
        models.Installations.setSuspendedByUserAndRepo(ctx, userId, repoId, suspended),
})

export const deleteInstallation = protectedMutation({
    args: { installationId: v.id('installations') },
    handler: (ctx, { installationId }) => models.Installations.delete(ctx, installationId),
})

export const deleteByGithubInstallationId = protectedMutation({
    args: { githubInstallationId: v.number() },
    handler: (ctx, { githubInstallationId }) =>
        models.Installations.deleteByGithubInstallationId(ctx, githubInstallationId),
})

export const setSuspendedByGithubInstallationId = protectedMutation({
    args: { githubInstallationId: v.number(), suspended: v.boolean() },
    handler: (ctx, { githubInstallationId, suspended }) =>
        models.Installations.setSuspendedByGithubInstallationId(
            ctx,
            githubInstallationId,
            suspended,
        ),
})

export const getUserInstallationToken = protectedQuery({
    args: { userId: v.id('users'), repoId: v.id('repos') },
    handler: (ctx, { userId, repoId }) => models.getUserInstallationToken(ctx, userId, repoId),
})

export const createInstallation = protectedMutation({
    args: {
        githubInstallationId: v.number(),
        githubUserId: v.number(),
        repos: v.array(v.object({ owner: v.string(), repo: v.string(), private: v.boolean() })),
    },
    handler: (ctx, args) => models.createInstallation(ctx, args),
})

export const deleteInstalledRepositoryData = protectedMutation({
    args: { githubInstallationId: v.number(), githubUserId: v.number() },
    handler: (ctx, args) => models.deleteInstalledRepositoryData(ctx, args),
})
