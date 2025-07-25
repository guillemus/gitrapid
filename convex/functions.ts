import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { mutation, query, QueryCtx } from './_generated/server'
import { parseRefAndPath } from './utils'

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

function getSavedCommitFromSha(ctx: QueryCtx, sha: string) {
    return ctx.db
        .query('commits')
        .filter((r) => r.eq(r.field('sha'), sha))
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
                isTag: v.boolean(),
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
                isTag: ref.isTag,
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
                .query('filenames')
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
        return ctx.db.insert('filenames', {
            commit: args.commitId,
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
                isTag: v.boolean(),
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
                    isTag: ref.isTag,
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
                    isTag: ref.isTag,
                })
            }
        }
    },
})

export const getRefAndPath = query({
    args: v.object({
        repoId: v.id('repos'),
        refAndPath: v.string(),
    }),
    async handler(ctx, args) {
        let refs = await getRefsFromRepo(ctx, args.repoId)
        let refsSet = new Set(refs.map((ref) => ref.ref))

        return parseRefAndPath(refsSet, args.refAndPath)
    },
})

export const insertRepo = mutation({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    async handler(ctx, args) {
        return ctx.db.insert('repos', args)
    },
})

export const getFiles = query({
    args: {
        commitId: v.id('commits'),
    },
    async handler(ctx, { commitId }) {
        return ctx.db
            .query('filenames')
            .withIndex('by_commit', (f) => f.eq('commit', commitId))
            .first()
    },
})

export const urlWithFilenames = query({
    args: {
        filenamesId: v.id('filenames'),
    },
    async handler(ctx, { filenamesId }) {
        let filenames = await ctx.db.get(filenamesId)
        if (!filenames) {
            return null
        }

        let commitId = filenames.commit
        let commit = await ctx.db.get(commitId)
        if (!commit) {
            return null
        }

        let repo = await ctx.db.get(commit.repo)
        if (!repo) {
            return null
        }

        return `http://localhost:3000/${repo.owner}/${repo.repo}/blob/${commit.sha}`
    },
})

export const getRefs = query({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    async handler(ctx, args) {
        let savedRepo = await getSavedRepo(ctx, args.owner, args.repo)
        if (!savedRepo) {
            console.error(`getRefs: repo not found - owner: ${args.owner}, repo: ${args.repo}`)
            return []
        }

        return getRefsFromRepo(ctx, savedRepo._id)
    },
})

export const getRefsAndCurrent = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let savedRepo = await getSavedRepo(ctx, owner, repo)
        if (!savedRepo) {
            return null
        }

        let commitIdAndRefs = await getCommitIdFromRef(ctx, savedRepo._id, refAndPath)
        if (!commitIdAndRefs) return null

        return commitIdAndRefs
    },
})

export const separateRefFromPath = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let savedRepo = await getSavedRepo(ctx, owner, repo)
        if (!savedRepo) {
            return null
        }

        // Fetch all refs for the repo to parse the refAndPath
        let refs = await getRefsFromRepo(ctx, savedRepo._id)
        let refsSet = new Set(refs.map((ref) => ref.ref))

        return parseRefAndPath(refsSet, refAndPath)
    },
})

async function getCommitIdFromRef(ctx: QueryCtx, repoId: Id<'repos'>, refAndPath: string) {
    let refs = await getRefsFromRepo(ctx, repoId)
    let refsSet = new Set(refs.map((ref) => ref.ref))

    let parsed = parseRefAndPath(refsSet, refAndPath)
    if (!parsed) {
        return null
    }

    for (let ref of refs) {
        if (ref.ref === parsed.ref) {
            return {
                ref: parsed.ref,
                commitId: ref.commit,
                refs,
            }
        }
    }

    return null
}

export const commitIdFromPath = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let savedRepo = await getSavedRepo(ctx, owner, repo)
        if (!savedRepo) {
            return null
        }

        let result = await getCommitIdFromRef(ctx, savedRepo._id, refAndPath)
        if (!result) {
            return null
        }

        return result.commitId
    },
})
