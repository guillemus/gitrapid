import { v } from 'convex/values'
import { api } from './_generated/api'
import { action, mutation, query } from './_generated/server'
import { GithubClient } from './GithubClient'
import { downloadAllRefs } from './utils'

// fixme: this should come from context instead
let githubClient = new GithubClient(process.env.GITHUB_TOKEN)

export const downloadRefs = action({
    async handler(ctx) {
        let owner = 'facebook'
        let repoName = 'react'

        return downloadAllRefs(ctx, githubClient, owner, repoName)
    },
})

export const downloadFilenames = action({
    async handler(ctx) {
        let owner = 'facebook'
        let repo = 'react'

        let refs = await ctx.runQuery(api.functions.getRepoRefs, { owner, repo })
        for (let ref of refs) {
            console.log('downloading filenames for ref', ref.ref)

            // has to be recursive.

            let tree = await githubClient.getRepoTree(owner, repo, ref.ref)
            if (tree.error) {
                console.error('failed to get tree for ref', ref.ref, tree.error)
                continue
            }

            console.log('got', tree.data.tree.length, 'files for ref', ref.ref)
        }
    },
})

// Return the last 100 tasks in a given task list.
export const getRepoRefs = query({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    handler: async (ctx, args) => {
        let repos = await ctx.db
            .query('repos')
            .filter(
                (repo) =>
                    repo.eq(repo.field('owner'), args.owner) &&
                    repo.eq(repo.field('repo'), args.repo),
            )
            .collect()

        let refs
        refs = await Promise.all(
            repos.map((repo) => {
                return ctx.db
                    .query('refs')
                    .filter((ref) => ref.eq(ref.field('repo'), repo._id))
                    .collect()
            }),
        )
        refs = refs.flatMap((r) => r)

        return refs
    },
})

export const getRepo = query({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    async handler(ctx, args) {
        let repo = await ctx.db
            .query('repos')
            .filter(
                (repo) =>
                    repo.eq(repo.field('owner'), args.owner) &&
                    repo.eq(repo.field('repo'), args.repo),
            )
            .first()

        return repo
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

export const insertCommitsAndRefs = mutation({
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
                .withIndex('by_commit_and_repo', (ref) =>
                    ref.eq('commit', commitId).eq('repo', args.repo),
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

export const getPathAndTree = action({
    args: v.object({
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    }),
    handler: async (ctx, input) => {
        // to do, parse refAndPath.
        let repoRefs = await ctx.runQuery(api.functions.getRepoRefs, input)

        let parts = input.refAndPath.split('/')
        let acc = ''
        let lastValidRef = ''
        refAndPathPartsLoop: for (let part of parts) {
            if (acc === '') {
                acc = part
            } else {
                acc = `${acc}/${part}`
            }

            for (let ref of repoRefs) {
                if (ref.ref === acc) {
                    lastValidRef = acc
                    continue refAndPathPartsLoop
                }
            }

            if (lastValidRef !== '') {
                break
            } else {
                // we don't have this ref stored in database, so this either means:
                // - we are not well synced (shouldn't happen)
                // - this is a commit
                // - user wrote some ref that doesn't exist anymore, we should return 404 like error
            }
        }

        return 'data'
    },
})
