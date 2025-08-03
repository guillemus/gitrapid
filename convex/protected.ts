// Protected functions are meant to be called server-to-server. In development
// they are more like laptop-to-server, so this dramatically speeds up development.

import { v } from 'convex/values'
import { query } from './_generated/server'
import { upsertIssueMutation } from './mutations'
import { appMutation, protectFn, withSecret } from './utils'

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

        return ctx.db.insert('repos', { owner: args.owner, repo: args.repo, private: false })
    },
})

export const upsertCommit = appMutation({
    args: withSecret({
        repoId: v.id('repos'),
        sha: v.string(),
    }),

    async handler(ctx, args) {
        protectFn(args)

        let commit = await ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (q) => q.eq('repo', args.repoId).eq('sha', args.sha))
            .unique()
        if (commit) {
            return commit._id
        }

        return ctx.db.insert('commits', {
            repo: args.repoId,
            sha: args.sha,
        })
    },
})

export const insertFilenames = appMutation({
    args: withSecret({
        commitId: v.id('commits'),
        fileList: v.array(v.string()),
    }),

    async handler(ctx, args) {
        protectFn(args)

        return ctx.db.insert('filenames', {
            commit: args.commitId,
            files: args.fileList,
        })
    },
})

export const insertFile = appMutation({
    args: withSecret({
        repoId: v.id('repos'),
        commitId: v.id('commits'),
        filename: v.string(),
        content: v.string(),
    }),

    async handler(ctx, args) {
        protectFn(args)

        return ctx.db.insert('files', {
            repo: args.repoId,
            commit: args.commitId,
            filename: args.filename,
            content: args.content,
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
                q.eq('repo', args.repoId).eq('commit', args.commitId),
            )
            .unique()
        if (ref) {
            return ref._id
        }

        return ctx.db.insert('refs', {
            repo: args.repoId,
            commit: args.commitId,
            ref: args.ref,
            isTag: args.isTag ?? false,
        })
    },
})

export const upsertIssue = appMutation({
    args: withSecret({
        repo: v.id('repos'),
        githubId: v.number(),
        number: v.number(),
        title: v.string(),
        state: v.union(v.literal('open'), v.literal('closed')),
        body: v.optional(v.string()),
        author: v.object({ login: v.string(), id: v.number() }),
        labels: v.optional(v.array(v.string())),
        assignees: v.optional(v.array(v.string())),
        createdAt: v.string(),
        updatedAt: v.string(),
        closedAt: v.optional(v.string()),
        comments: v.optional(v.number()),
    }),
    async handler(ctx, args) {
        return await upsertIssueMutation(ctx, args)
    },
})
