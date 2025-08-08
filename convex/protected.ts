// Protected functions are meant to be called server-to-server. In development
// they are more like laptop-to-server, so this dramatically speeds up development.

import { v } from 'convex/values'
import * as models from './models/models'
import * as schemas from './schema'
import { protectedMutation, protectedQuery } from './utils'

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
    handler: (ctx, args) => models.Repos.get(ctx, args.owner, args.repo),
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

export const setRepoHead = protectedMutation({
    args: { repoId: v.id('repos'), headRefName: v.string() },
    handler: (ctx, args) => models.setRepoHead(ctx, args.repoId, args.headRefName),
})

export const getRef = protectedQuery({
    args: { refId: v.id('refs') },
    handler: (ctx, args) => models.Refs.get(ctx, args.refId),
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
    args: {
        repoId: v.id('repos'),
        repoMetaEtag: v.optional(v.string()),
        refsEtagHeads: v.optional(v.string()),
        refsEtagTags: v.optional(v.string()),
        issuesSince: v.optional(v.string()),
        commentsSince: v.optional(v.string()),
        syncError: v.optional(v.object({ code: v.string(), message: v.optional(v.string()) })),
    },
    handler: (ctx, args) => models.SyncStates.upsert(ctx, args),
})
