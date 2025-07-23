import { v } from 'convex/values'
import { api } from './_generated/api'
import { Id } from './_generated/dataModel'
import { action, mutation, query, QueryCtx } from './_generated/server'
import { GithubClient } from './GithubClient'
import { downloadAllRefs, parseRefAndPath } from './utils'

// fixme: this should come from context instead
let githubClient = new GithubClient(process.env.GITHUB_TOKEN)

export const downloadRefs = action({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, args) {
        return downloadAllRefs(ctx, githubClient, args.owner, args.repo)
    },
})

function getRefsFromRepo(ctx: QueryCtx, repoId: Id<'repos'>) {
    return ctx.db
        .query('refs')
        .withIndex('by_repo', (r) => r.eq('repo', repoId))
        .collect()
}

function getSavedRepo(ctx: QueryCtx, owner: string, repo: string) {
    return ctx.db
        .query('repos')
        .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
        .first()
}

export const getRepoFromId = query({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        return ctx.db.get(args.repoId)
    },
})

export const getRepo = query({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    handler: async (ctx, args) => {
        return getSavedRepo(ctx, args.owner, args.repo)
    },
})

export const getRepoRefs = query({
    args: {
        repoId: v.id('repos'),
    },
    handler: async (ctx, args) => {
        let refs = await getRefsFromRepo(ctx, args.repoId)
        return refs
    },
})

export const insertRefs = mutation({
    args: {
        repoId: v.id('repos'),
        refs: v.array(
            v.object({
                sha: v.string(),
                ref: v.string(),
            }),
        ),
    },

    async handler(ctx, args) {
        for (let ref of args.refs) {
            let saved = await ctx.db
                .query('commits')
                .withIndex('by_repo_and_sha', (c) => c.eq('repo', args.repoId).eq('sha', ref.sha))
                .first()

            if (!saved) {
                console.error(`ref ${ref.ref} with inexistent sha ${ref.sha}`)
                continue
            }

            await ctx.db.insert('refs', {
                repo: args.repoId,
                commit: saved._id,
                ref: ref.ref,
            })
        }
    },
})

export const insertCommits = mutation({
    args: {
        repoId: v.id('repos'),
        commits: v.array(v.string()),
    },
    async handler(ctx, args) {
        for (let commit of args.commits) {
            let saved = await ctx.db
                .query('commits')
                .withIndex('by_repo_and_sha', (c) => c.eq('repo', args.repoId).eq('sha', commit))
                .first()

            if (saved) {
                continue
            }

            await ctx.db.insert('commits', {
                repo: args.repoId,
                sha: commit,
            })
        }
    },
})

export const getAllRepoCommitsWithoutFiles = query({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let commits = await ctx.db
            .query('commits')
            .withIndex('by_repo', (c) => c.eq('repo', args.repoId))
            .collect()

        let commitsWithoutFiles = []
        for (let commit of commits) {
            let savedCommitFiles = await ctx.db
                .query('commitFiles')
                .withIndex('by_commit', (c) => c.eq('commit', commit._id))
                .first()

            if (!savedCommitFiles) {
                commitsWithoutFiles.push(commit)
            }
        }

        return commitsWithoutFiles
    },
})

export const upsertFiles = mutation({
    args: {
        commitId: v.id('commits'),
        fileNames: v.array(v.string()),
    },

    async handler(ctx, args) {
        let commitFileId = await ctx.db.insert('commitFiles', { commit: args.commitId })

        await ctx.db.insert('filenames', {
            commitFileId,
            files: args.fileNames,
        })
    },
})

export const upsertCommitsAndRefs = mutation({
    args: {
        repo: v.id('repos'),
        refs: v.array(
            v.object({
                sha: v.string(),
                ref: v.string(),
            }),
        ),
    },
    async handler(ctx, args) {
        for (let ref of args.refs) {
            let savedCommit = await ctx.db
                .query('commits')
                .withIndex('by_repo_and_sha', (c) => c.eq('repo', args.repo).eq('sha', ref.sha))
                .first()

            let commitId = savedCommit?._id
            if (!commitId) {
                commitId = await ctx.db.insert('commits', {
                    repo: args.repo,
                    sha: ref.sha,
                })
            }

            let savedRefs = await ctx.db
                .query('refs')
                .withIndex('by_repo_and_commit', (ref) =>
                    ref.eq('repo', args.repo).eq('commit', commitId),
                )
                .collect()

            if (!savedRefs.length) {
                await ctx.db.insert('refs', {
                    commit: commitId,
                    ref: ref.ref,
                    repo: args.repo,
                })
                continue
            }

            let savedRef = savedRefs.filter((r) => r.ref === ref.ref)[0]
            if (savedRef) {
                await ctx.db.patch(savedRef._id, {
                    commit: commitId,
                })
            } else {
                await ctx.db.insert('refs', {
                    repo: args.repo,
                    ref: ref.ref,
                    commit: commitId,
                })
            }
        }
    },
})

export const getFile = action({
    args: v.object({
        repoId: v.id('repos'),
        refAndPath: v.string(),
    }),
    handler: async (ctx, args) => {
        let repoP = ctx.runQuery(api.functions.getRepoFromId, { repoId: args.repoId })

        let repoRefs = await ctx.runQuery(api.functions.getRepoRefs, { repoId: args.repoId })
        if (!repoRefs) {
            console.error('not found repo refs')
            return null
        }

        let repo = await repoP
        if (!repo) {
            console.error('repo not found')
            return null
        }

        let repoRefsSet = new Set([...repoRefs.map((ref) => ref.ref)])

        let parsed = parseRefAndPath(repoRefsSet, args.refAndPath)
        if (!parsed) {
            console.error('error parsing path', args)
            return null
        }

        let fileContentsRes = await githubClient.getFileContentByAPI(
            repo.owner,
            repo.repo,
            parsed.path,
            parsed.ref,
        )
        if (fileContentsRes.error) {
            console.error(fileContentsRes.error)
            return null
        }

        if (Array.isArray(fileContentsRes.data)) {
            console.info('file contents is a directory', fileContentsRes.data)
            return null
        }

        if (fileContentsRes.data.type === 'file') {
            return atob(fileContentsRes.data.content)
        }

        console.log('file contents is something else', fileContentsRes.data)
        return null
    },
})

export const insertRepo = mutation({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    async handler(ctx, args) {
        return await ctx.db.insert('repos', args)
    },
})
