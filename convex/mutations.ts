import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import * as models from './models/models'
import { issuesSchema } from './schema'

export const upsertIssue = internalMutation({
    args: issuesSchema,
    handler: models.Issues.upsert,
})

export const getOrCreateRepo = internalMutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    handler: models.Repos.getOrCreate,
})

export const addInstallation = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        installationId: v.number(),
    },
    handler: (ctx, args) =>
        models.Installations.getOrCreate(ctx, {
            userId: args.userId,
            repoId: args.repoId,
            installationId: args.installationId,
            suspended: false,
        }),
})

export const handleInstallationCreated = internalMutation({
    args: {
        installationId: v.number(),
        githubUserId: v.number(),
        repos: v.array(
            v.object({
                owner: v.string(),
                repo: v.string(),
                private: v.boolean(),
            }),
        ),
    },
    handler: models.createInstallation,
})

export const deleteInstallation = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    handler: (ctx, args) => models.Installations.deleteByUserAndRepo(ctx, args.userId, args.repoId),
})

export const setInstallationSuspended = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        suspended: v.boolean(),
    },
    handler: (ctx, args) =>
        models.Installations.setSuspendedByUserAndRepo(
            ctx,
            args.userId,
            args.repoId,
            args.suspended,
        ),
})

export const deleteInstallationByInstallationId = internalMutation({
    args: {
        installationId: v.number(),
    },
    handler: (ctx, args) => models.Installations.deleteByInstallationId(ctx, args.installationId),
})

export const setInstallationSuspendedByInstallationId = internalMutation({
    args: {
        installationId: v.number(),
        suspended: v.boolean(),
    },
    handler: (ctx, args) =>
        models.Installations.setSuspendedByInstallationId(ctx, args.installationId, args.suspended),
})

export const setRepoHead = internalMutation({
    args: {
        repoId: v.id('repos'),
        headRefName: v.string(),
    },
    handler: (ctx, args) => models.setRepoHead(ctx, args.repoId, args.headRefName),
})
