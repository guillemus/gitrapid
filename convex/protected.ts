// Protected functions are meant to be called server-to-server. In development
// they are more like laptop-to-server, so this dramatically speeds up development.

import { v } from 'convex/values'
import { query } from './_generated/server'
import { upsertIssueMutation } from './mutations'
import {
    blobsSchema,
    commitsSchema,
    issuesSchema,
    refsSchema,
    treeEntriesSchema,
    treesSchema,
} from './schema'
import { appMutation } from './triggers'
import { protectFn, withSecret } from './utils'

export const getPat = query({
    args: withSecret({
        userId: v.id('users'),
    }),

    async handler(ctx, args) {
        protectFn(args)

        return ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
            .unique()
    },
})

export const upsertRepo = appMutation({
    args: withSecret({
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    }),

    async handler(ctx, args) {
        protectFn(args)

        let repo = await ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (q) => q.eq('owner', args.owner).eq('repo', args.repo))
            .unique()
        if (repo) {
            return repo._id
        }

        return ctx.db.insert('repos', {
            owner: args.owner,
            repo: args.repo,
            private: args.private,
        })
    },
})

export const upsertRef = appMutation({
    args: withSecret({
        repoId: v.id('repos'),
        commitId: v.id('commits'),
        ref: v.string(),
        isTag: v.boolean(),
    }),

    async handler(ctx, args) {
        protectFn(args)

        let ref = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (q) =>
                q.eq('repoId', args.repoId).eq('commitId', args.commitId),
            )
            .unique()
        if (ref) {
            return ref._id
        }

        return ctx.db.insert('refs', {
            repoId: args.repoId,
            commitId: args.commitId,
            name: args.ref,
            isTag: args.isTag ?? false,
        })
    },
})

export const upsertIssue = appMutation({
    args: withSecret(issuesSchema),
    async handler(ctx, args) {
        return await upsertIssueMutation(ctx, args)
    },
})

export const upsertIssueComment = appMutation({
    args: withSecret({
        issueId: v.id('issues'),
        githubId: v.number(),
        author: v.object({ id: v.number(), login: v.string() }),
        body: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
    }),
    async handler(ctx, args) {
        protectFn(args)

        return ctx.db.insert('issueComments', args)
    },
})

export const upsertBlob = appMutation({
    args: withSecret(blobsSchema),

    async handler(ctx, args) {
        protectFn(args)

        let blob = await ctx.db
            .query('blobs')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', args.repoId).eq('sha', args.sha))
            .unique()

        if (blob) {
            return blob._id
        }

        return ctx.db.insert('blobs', {
            repoId: args.repoId,
            sha: args.sha,
            content: args.content,
            encoding: args.encoding,
            size: args.size,
        })
    },
})

export const upsertTree = appMutation({
    args: withSecret(treesSchema),

    async handler(ctx, args) {
        protectFn(args)

        let tree = await ctx.db
            .query('trees')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', args.repoId).eq('sha', args.sha))
            .unique()

        if (tree) {
            return tree._id
        }

        return ctx.db.insert('trees', {
            repoId: args.repoId,
            sha: args.sha,
        })
    },
})

export const upsertTreeEntry = appMutation({
    args: withSecret(treeEntriesSchema),

    async handler(ctx, args) {
        protectFn(args)

        // Check if this tree entry already exists
        let existing = await ctx.db
            .query('treeEntries')
            .withIndex('by_repo_and_tree', (q) =>
                q.eq('repoId', args.repoId).eq('treeId', args.treeId),
            )
            .filter((q) => q.eq(q.field('name'), args.name))
            .unique()

        if (existing) {
            return existing._id
        }

        return ctx.db.insert('treeEntries', {
            repoId: args.repoId,
            treeId: args.treeId,
            mode: args.mode,
            name: args.name,
            object: args.object,
        })
    },
})

export const upsertCommit = appMutation({
    args: withSecret(commitsSchema),

    async handler(ctx, args) {
        protectFn(args)

        let commit = await ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', args.repoId).eq('sha', args.sha))
            .unique()

        if (commit) {
            return commit._id
        }

        return ctx.db.insert('commits', {
            repoId: args.repoId,
            sha: args.sha,
            treeId: args.treeId,
            message: args.message,
            author: args.author,
            committer: args.committer,
        })
    },
})

export const upsertGitRef = appMutation({
    args: withSecret(refsSchema),

    async handler(ctx, args) {
        protectFn(args)

        let ref = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_name', (q) => q.eq('repoId', args.repoId).eq('name', args.name))
            .unique()

        if (ref) {
            // Update existing ref to point to new commit
            await ctx.db.patch(ref._id, { commitId: args.commitId })
            return ref._id
        }

        return ctx.db.insert('refs', {
            repoId: args.repoId,
            name: args.name,
            commitId: args.commitId,
            isTag: args.isTag ?? false,
        })
    },
})

// Just for testing purposes, this should not be used
export const getFirstPat = query({
    args: withSecret({}),
    async handler(ctx, args) {
        protectFn(args)

        return ctx.db.query('pats').first()
    },
})
