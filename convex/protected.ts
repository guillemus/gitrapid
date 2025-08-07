// Protected functions are meant to be called server-to-server. In development
// they are more like laptop-to-server, so this dramatically speeds up development.

import { v } from 'convex/values'
import { query } from './_generated/server'
import * as models from './models/models'
import * as schemas from './schema'
import { appMutation } from './triggers'
import { protectFn, withSecret } from './utils'

export const getPat = query({
    args: withSecret({
        userId: v.id('users'),
    }),

    async handler(ctx, args) {
        protectFn(args)

        return models.PAT.getByUserId(ctx, args.userId)
    },
})

export const getOrCreateRepo = appMutation({
    args: withSecret(schemas.reposSchema),

    async handler(ctx, args) {
        protectFn(args)
        return models.Repos.getOrCreate(ctx, args)
    },
})

export const getOrCreateRef = appMutation({
    args: withSecret(schemas.refsSchema),

    async handler(ctx, args) {
        protectFn(args)
        return models.Refs.getOrCreate(ctx, args)
    },
})

export const getOrCreateIssue = appMutation({
    args: withSecret(schemas.issuesSchema),
    async handler(ctx, args) {
        return await models.Issues.getOrCreate(ctx, args)
    },
})

export const getOrCreateIssueComment = appMutation({
    args: withSecret(schemas.issueCommentsSchema),
    async handler(ctx, args) {
        protectFn(args)

        return await models.IssueComments.getOrCreate(ctx, args)
    },
})

export const getOrCreateBlob = appMutation({
    args: withSecret(schemas.blobsSchema),

    async handler(ctx, args) {
        protectFn(args)

        return await models.Blobs.getOrCreate(ctx, args)
    },
})

export const upsertBlob = appMutation({
    args: withSecret(schemas.blobsSchema),
    async handler(ctx, { secret, ...args }) {
        protectFn({ secret })
        return await models.Blobs.patchOrCreate(ctx, args)
    },
})

export const getOrCreateTree = appMutation({
    args: withSecret(schemas.treesSchema),

    async handler(ctx, args) {
        protectFn(args)

        return await models.Trees.getOrCreate(ctx, args)
    },
})

export const getOrCreateTreeEntry = appMutation({
    args: withSecret(schemas.treeEntriesSchema),

    async handler(ctx, args) {
        protectFn(args)

        return await models.TreeEntries.getOrCreate(ctx, args)
    },
})

export const isCommitWritten = appMutation({
    args: withSecret({
        repoId: v.id('repos'),
        sha: v.string(),
    }),

    async handler(ctx, args) {
        protectFn(args)

        let commit = await models.Commits.getByRepoAndSha(ctx, args.repoId, args.sha)
        return commit !== null
    },
})

export const getOrCreateCommit = appMutation({
    args: withSecret(schemas.commitsSchema),

    async handler(ctx, args) {
        protectFn(args)

        return models.Commits.getOrCreate(ctx, args)
    },
})

export const upsertRefs = appMutation({
    args: withSecret({
        refs: v.array(v.object(schemas.refsSchema)),
    }),
    async handler(ctx, args) {
        protectFn(args)

        return models.Refs.upsertMany(ctx, args.refs)
    },
})

export const setRepoHead = appMutation({
    args: withSecret({
        repoId: v.id('repos'),
        headRefName: v.string(),
    }),
    async handler(ctx, args) {
        protectFn(args)

        return models.setRepoHead(ctx, args.repoId, args.headRefName)
    },
})
