import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { mutation, query, QueryCtx } from './_generated/server'
import { parseRefAndPath } from './utils'

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
        return ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), args.owner) && r.eq(r.field('repo'), args.repo))
            .first()
    },
})

export const getAllRepos = query({
    async handler(ctx) {
        return ctx.db.query('repos').collect()
    },
})

export const getRepoRefs = query({
    args: {
        repoId: v.id('repos'),
    },
    handler: async (ctx, args) => {
        let refs = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (r) => r.eq('repo', args.repoId))
            .collect()
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
        return ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (c) => c.eq('repo', args.repoId))
            .filter((c) => c.eq(c.field('filenames'), undefined))
            .collect()
    },
})

export const upsertFiles = mutation({
    args: {
        commitId: v.id('commits'),
        fileNames: v.array(v.string()),
    },

    async handler(ctx, args) {
        let insertedFilenames = await ctx.db.insert('filenames', {
            commit: args.commitId,
            files: args.fileNames,
        })
        await ctx.db.patch(args.commitId, { filenames: insertedFilenames })
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
        let refs = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (r) => r.eq('repo', args.repoId))
            .collect()

        return parseRefAndPath(
            refs.map((ref) => ref.ref),
            args.refAndPath,
        )
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
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), args.owner) && r.eq(r.field('repo'), args.repo))
            .first()
        if (!savedRepo) {
            console.error(`getRefs: repo not found - owner: ${args.owner}, repo: ${args.repo}`)
            return []
        }

        return ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (r) => r.eq('repo', savedRepo._id))
            .collect()
    },
})

export const getRefsAndCurrent = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
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
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
        if (!savedRepo) {
            return null
        }

        let refs = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (r) => r.eq('repo', savedRepo._id))
            .collect()

        return parseRefAndPath(
            refs.map((ref) => ref.ref),
            refAndPath,
        )
    },
})

async function getCommitIdFromRef(ctx: QueryCtx, repoId: Id<'repos'>, refAndPath: string) {
    let refs = await ctx.db
        .query('refs')
        .withIndex('by_repo_and_commit', (r) => r.eq('repo', repoId))
        .collect()

    let parsed = parseRefAndPath(
        refs.map((ref) => ref.ref),
        refAndPath,
    )
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
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
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

export const filesAndCommitIdFromPath = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
        if (!savedRepo) {
            return null
        }

        let result = await getCommitIdFromRef(ctx, savedRepo._id, refAndPath)
        if (!result) {
            return null
        }

        let commitId = result.commitId
        let files = await ctx.db
            .query('filenames')
            .withIndex('by_commit', (f) => f.eq('commit', commitId))
            .first()

        return {
            files: files ? files.files : [],
            commitId,
        }
    },
})

export const getRepoAndRefs = query({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    async handler(ctx, { owner, repo }) {
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
        if (!savedRepo) {
            console.error(`getRepoAndRefs: repo not found - owner: ${owner}, repo: ${repo}`)
            return null
        }
        let refs = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (r) => r.eq('repo', savedRepo._id))
            .collect()
        if (!refs) {
            console.error(
                `getRepoAndRefs: refs not found for repo - owner: ${owner}, repo: ${repo}`,
            )
            return null
        }

        return {
            repo: savedRepo,
            refs,
        }
    },
})

export const insertFilenames = mutation({
    args: {
        commitId: v.id('commits'),
        fileList: v.array(v.string()),
    },
    async handler(ctx, { commitId, fileList }) {
        let saved = await ctx.db
            .query('filenames')
            .withIndex('by_commit', (f) => f.eq('commit', commitId))
            .first()

        if (saved) {
            return saved._id
        }

        return await ctx.db.insert('filenames', { commit: commitId, files: fileList })
    },
})

export const insertCommit = mutation({
    args: {
        repoId: v.id('repos'),
        sha: v.string(),
    },
    async handler(ctx, { repoId, sha }) {
        let saved = await ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (c) => c.eq('repo', repoId).eq('sha', sha))
            .first()

        if (saved) {
            return saved._id
        }
        return await ctx.db.insert('commits', { repo: repoId, sha })
    },
})

export const updateCommit = mutation({
    args: {
        commitId: v.id('commits'),
        filenamesId: v.id('filenames'),
    },
    async handler(ctx, { commitId, filenamesId }) {
        await ctx.db.patch(commitId, { filenames: filenamesId })
    },
})

export const insertFile = mutation({
    args: {
        repoId: v.id('repos'),
        commitId: v.id('commits'),
        filename: v.string(),
        content: v.string(),
    },
    async handler(ctx, { repoId, commitId, filename, content }) {
        let saved = await ctx.db
            .query('files')
            .withIndex('by_repo_and_commit', (f) => f.eq('repo', repoId).eq('commit', commitId))
            .filter((f) => f.eq(f.field('filename'), filename))
            .first()

        if (saved) {
            await ctx.db.patch(saved._id, { content })
            return saved._id
        }
        return await ctx.db.insert('files', { repo: repoId, commit: commitId, filename, content })
    },
})

export const getRepoPage = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
        if (!savedRepo) {
            console.error(`getRepoPage: repo not found - owner: ${owner}, repo: ${repo}`)
            return null
        }

        let refs = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (r) => r.eq('repo', savedRepo._id))
            .collect()
        if (!refs) {
            console.error(`getRepoPage: refs not found for repo - owner: ${owner}, repo: ${repo}`)
            return null
        }

        let refNames = refs.map((ref) => ref.ref)
        let parsed = parseRefAndPath(refNames, refAndPath)
        if (!parsed) {
            console.error(
                `getRepoPage: error parsing ref and path - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
            return null
        }

        let ref = refs.find((r) => r.ref === parsed.ref)
        if (!ref) {
            console.error(
                `getRepoPage: ref not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}`,
            )
            return null
        }

        let fileContents = await ctx.db
            .query('files')
            .withIndex('by_repo_and_commit', (f) =>
                f.eq('repo', savedRepo._id).eq('commit', ref.commit),
            )
            .filter((f) => f.eq(f.field('filename'), parsed.path))
            .first()

        if (!fileContents) {
            console.error(
                `getRepoPage: file not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}, path: ${parsed.path}`,
            )
            return null
        }

        let filenames = await ctx.db
            .query('filenames')
            .withIndex('by_commit', (f) => f.eq('commit', ref.commit))
            .first()
        if (!filenames) {
            console.error(
                `getRepoPage: filenames not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}, path: ${parsed.path}`,
            )
            return null
        }

        return {
            ref: ref.ref,
            commitId: ref.commit,
            fileContents: fileContents.content,
            repoId: savedRepo._id,
            refs: refs,
            files: filenames.files,
        }
    },
})

export const getFile = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
        if (!savedRepo) {
            return null
        }

        let refs = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (r) => r.eq('repo', savedRepo._id))
            .collect()
        if (!refs) {
            console.error(`getFile: refs not found for repo - owner: ${owner}, repo: ${repo}`)
            return null
        }

        let refNames = refs.map((ref) => ref.ref)
        let parsed = parseRefAndPath(refNames, refAndPath)
        if (!parsed) {
            console.error(
                `getFile: error parsing ref and path - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
            return null
        }

        let ref = refs.find((r) => r.ref === parsed.ref)
        if (!ref) {
            console.error(
                `getFile: ref not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}`,
            )
            return null
        }

        let fileContents = await ctx.db
            .query('files')
            .withIndex('by_repo_and_commit', (f) =>
                f.eq('repo', savedRepo._id).eq('commit', ref.commit),
            )
            .filter((f) => f.eq(f.field('filename'), parsed.path))
            .first()

        if (!fileContents) {
            console.error(
                `getFile: file not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}, path: ${parsed.path}`,
            )
            return null
        }

        return fileContents.content
    },
})
