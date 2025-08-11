// Protected functions are meant to be called server-to-server. In development
// they are more like laptop-to-server, so this dramatically speeds up development.

import { v } from 'convex/values'
import * as models from './models/models'
import * as schemas from './schema'
import { err, protectedMutation, protectedQuery } from './utils'

export const getPat = protectedQuery({
    args: { userId: v.id('users') },
    handler: (ctx, args) => models.PAT.getByUserId(ctx, args.userId),
})

export const getOrCreateRepo = protectedMutation({
    args: schemas.reposSchema,
    handler: (ctx, args) => models.Repos.getOrCreate(ctx, args),
})

export const getRepo = protectedQuery({
    args: { owner: v.string(), repo: v.string() },
    handler: (ctx, args) => models.Repos.getByOwnerRepo(ctx, args.owner, args.repo),
})

export const getOrCreateRef = protectedMutation({
    args: schemas.refsSchema,
    handler: (ctx, args) => models.Refs.getOrCreate(ctx, args),
})

export const getOrCreateIssue = protectedMutation({
    args: schemas.issuesSchema,
    handler: (ctx, args) => models.Issues.getOrCreate(ctx, args),
})

export const getOrCreateIssueComment = protectedMutation({
    args: schemas.issueCommentsSchema,
    handler: (ctx, args) => models.IssueComments.getOrCreate(ctx, args),
})

export const getOrCreateBlob = protectedMutation({
    args: schemas.blobsSchema,
    handler: (ctx, args) => models.Blobs.getOrCreate(ctx, args),
})

export const upsertBlob = protectedMutation({
    args: schemas.blobsSchema,
    handler: (ctx, args) => models.Blobs.patchOrCreate(ctx, args),
})

export const getOrCreateTree = protectedMutation({
    args: schemas.treesSchema,
    handler: (ctx, args) => models.Trees.getOrCreate(ctx, args),
})

export const getOrCreateTreeEntry = protectedMutation({
    args: schemas.treeEntriesSchema,
    handler: (ctx, args) => models.TreeEntries.getOrCreate(ctx, args),
})

export const isCommitWritten = protectedMutation({
    args: { repoId: v.id('repos'), sha: v.string() },
    handler: (ctx, args) => models.Commits.getByRepoAndSha(ctx, args.repoId, args.sha),
})

export const getOrCreateCommit = protectedMutation({
    args: schemas.commitsSchema,
    handler: (ctx, args) => models.Commits.getOrCreate(ctx, args),
})

export const upsertRefs = protectedMutation({
    args: { refs: v.array(v.object(schemas.refsSchema)) },
    handler: (ctx, args) => models.Refs.upsertMany(ctx, args.refs),
})

export const reconcileRefs = protectedMutation({
    args: {
        repoId: v.id('repos'),
        refs: v.array(
            v.object({ name: v.string(), commitSha: v.string(), isTag: v.optional(v.boolean()) }),
        ),
    },
    handler: (ctx, args) => models.Refs.reconcile(ctx, args.repoId, args.refs),
})

export const setRepoHead = protectedMutation({
    args: { repoId: v.id('repos'), headRefName: v.string() },
    handler: (ctx, args) => models.setRepoHead(ctx, args.repoId, args.headRefName),
})

export const getRef = protectedQuery({
    args: { refId: v.id('refs') },
    handler: (ctx, args) => models.Refs.get(ctx, args.refId),
})

export const listRefsByRepo = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, args) => models.Refs.getRefsFromRepo(ctx, args.repoId),
})

export const getOrCreateSyncState = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, args) => models.SyncStates.getOrCreate(ctx, { repoId: args.repoId }),
})

export const getSyncState = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, args) => models.SyncStates.getByRepoId(ctx, args.repoId),
})

export const upsertSyncState = protectedMutation({
    args: schemas.syncStatesSchema,
    handler: (ctx, args) => models.SyncStates.upsert(ctx, args),
})

export const getInstallationTokenForUserRepo = protectedQuery({
    args: { userId: v.id('users'), repoId: v.id('repos') },
    handler: (ctx, args) => models.getUserInstallationToken(ctx, args.userId, args.repoId),
})

export const getUserIdFromGithubUserId = protectedQuery({
    args: { githubUserId: v.number() },
    handler: (ctx, args) => models.getUserIdFromGithubUserId(ctx, args.githubUserId),
})

export const upsertIssue = protectedMutation({
    args: schemas.issuesSchema,
    handler: models.Issues.upsert,
})

export const addInstallation = protectedMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        githubInstallationId: v.number(),
    },
    handler: (ctx, args) =>
        models.Installations.getOrCreate(ctx, {
            userId: args.userId,
            repoId: args.repoId,
            githubInstallationId: args.githubInstallationId,
            suspended: false,
        }),
})

export const createInstallation = protectedMutation({
    args: {
        githubInstallationId: v.number(),
        githubUserId: v.number(),
        repos: v.array(
            v.object({
                owner: v.string(),
                repo: v.string(),
                private: v.boolean(),
            }),
        ),
    },
    handler: (ctx, args) =>
        models.createInstallation(ctx, {
            githubInstallationId: args.githubInstallationId,
            githubUserId: args.githubUserId,
            repos: args.repos,
        }),
})

export const deleteInstallation = protectedMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    handler: (ctx, args) => models.Installations.deleteByUserAndRepo(ctx, args.userId, args.repoId),
})

export const setInstallationSuspended = protectedMutation({
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

export const deleteInstallationByInstallationId = protectedMutation({
    args: {
        githubInstallationId: v.number(),
    },
    handler: (ctx, args) =>
        models.Installations.deleteByGithubInstallationId(ctx, args.githubInstallationId),
})

export const setInstallationSuspendedByInstallationId = protectedMutation({
    args: {
        githubInstallationId: v.number(),
        suspended: v.boolean(),
    },
    handler: (ctx, args) =>
        models.Installations.setSuspendedByGithubInstallationId(
            ctx,
            args.githubInstallationId,
            args.suspended,
        ),
})

export const upsertInstallation = protectedMutation({
    args: {
        repoId: v.id('repos'),
        userId: v.id('users'),
        githubInstallationId: v.number(),
        token: v.string(),
        expiresAt: v.string(),
    },
    handler: async (ctx, args) => {
        let installation = await models.Installations.upsert(ctx, {
            repoId: args.repoId,
            userId: args.userId,
            githubInstallationId: args.githubInstallationId,
            suspended: false,
        })
        if (!installation) throw new Error('installation not found')

        let installationAccessToken = await models.InstallationAccessTokens.upsert(ctx, {
            installationId: installation._id,
            token: args.token,
            expiresAt: args.expiresAt,
        })
        if (!installationAccessToken) throw new Error('installation access token not found')

        return {
            installation,
            accessToken: installationAccessToken,
        }
    },
})
