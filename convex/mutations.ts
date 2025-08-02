import { v, type Infer } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalAction, internalMutation, type MutationCtx } from './_generated/server'
import type { WithoutSystemFields } from 'convex/server'

export const insertRefs = internalMutation({
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
                .unique()

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

export const insertCommits = internalMutation({
    args: {
        repoId: v.id('repos'),
        commits: v.array(v.string()),
    },
    async handler(ctx, args) {
        for (let commit of args.commits) {
            let saved = await ctx.db
                .query('commits')
                .withIndex('by_repo_and_sha', (c) => c.eq('repo', args.repoId).eq('sha', commit))
                .unique()

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

export const upsertCommitsAndRefs = internalMutation({
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
                .unique()

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

export const insertFilenames = internalMutation({
    args: {
        commitId: v.id('commits'),
        fileList: v.array(v.string()),
    },
    async handler(ctx, { commitId, fileList }) {
        let saved = await ctx.db
            .query('filenames')
            .withIndex('by_commit', (f) => f.eq('commit', commitId))
            .unique()

        if (saved) {
            return saved._id
        }

        return await ctx.db.insert('filenames', { commit: commitId, files: fileList })
    },
})

export const insertCommit = internalMutation({
    args: {
        repoId: v.id('repos'),
        sha: v.string(),
    },
    async handler(ctx, { repoId, sha }) {
        let saved = await ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (c) => c.eq('repo', repoId).eq('sha', sha))
            .unique()

        if (saved) {
            return saved._id
        }
        return await ctx.db.insert('commits', { repo: repoId, sha })
    },
})

export const insertFile = internalMutation({
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
            .unique()

        if (saved) {
            await ctx.db.patch(saved._id, { content })
            return saved._id
        }
        return await ctx.db.insert('files', { repo: repoId, commit: commitId, filename, content })
    },
})

export const updateRepoHead = internalMutation({
    args: {
        repoId: v.id('repos'),
        head: v.id('refs'),
    },
    async handler(ctx, { repoId, head }) {
        await ctx.db.patch(repoId, { head })
    },
})

export const saveInstallationToken = internalMutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        token: v.string(),
        expiresAt: v.string(),
    },
    async handler(ctx, args) {
        let repo = await ctx.db
            .query('repos')
            .filter((q) => q.eq(q.field('owner'), args.owner) && q.eq(q.field('repo'), args.repo))
            .unique()
        if (!repo) {
            return null
        }

        let existingToken = await ctx.db
            .query('installationAccessTokens')
            .withIndex('by_repo_id', (q) => q.eq('repoId', repo._id))
            .unique()
        if (existingToken) {
            await ctx.db.delete(existingToken._id)
        }

        return ctx.db.insert('installationAccessTokens', {
            repoId: repo._id,
            token: args.token,
            expiresAt: args.expiresAt,
        })
    },
})

export const upsertIssue = internalMutation({
    args: {
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
    },
    async handler(ctx, args) {
        return await upsertIssueMutation(ctx, args)
    },
})

export async function upsertIssueMutation(
    ctx: MutationCtx,
    args: WithoutSystemFields<Doc<'issues'>>,
) {
    const existing = await ctx.db
        .query('issues')
        .withIndex('by_repo_and_number', (q) => q.eq('repo', args.repo).eq('number', args.number))
        .unique()
    if (existing) {
        await ctx.db.patch(existing._id, args)

        if (existing.state === args.state) return

        let repoCounts = await ctx.db
            .query('repoCounts')
            .withIndex('by_repoId', (q) => q.eq('repoId', args.repo))
            .unique()
        if (!repoCounts) {
            await ctx.db.insert('repoCounts', {
                repoId: args.repo,
                openIssues: 0,
                closedIssues: 0,
                openPullRequests: 0,
                closedPullRequests: 0,
            })
        }
    } else {
        await ctx.db.insert('issues', args)
    }
}

export const upsertRepo = internalMutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        return await upsertRepoMutation(ctx, args)
    },
})

export const addInstallation = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        installationId: v.string(),
    },
    async handler(ctx, args) {
        return await addInstallationMutation(ctx, args)
    },
})

export const handleInstallationCreated = internalMutation({
    args: {
        installationId: v.string(),
        githubUserId: v.number(),
        repos: v.array(
            v.object({
                owner: v.string(),
                repo: v.string(),
                private: v.boolean(),
            }),
        ),
    },
    async handler(ctx, args) {
        const authAccount = await ctx.db
            .query('authAccounts')
            .withIndex('providerAndAccountId', (q) =>
                q.eq('provider', 'github').eq('providerAccountId', args.githubUserId.toString()),
            )
            .unique()

        if (!authAccount) {
            console.log(`User with GitHub ID ${args.githubUserId} not found in auth system.`)
            return
        }

        for (const repoData of args.repos) {
            const repoId = await upsertRepoMutation(ctx, repoData)

            await addInstallationMutation(ctx, {
                userId: authAccount.userId,
                repoId,
                installationId: args.installationId,
            })
        }

        console.log(`Successfully processed installation for user ${authAccount.userId}`)
    },
})

export const deleteInstallation = internalMutation({
    args: {
        installationId: v.string(),
    },
    async handler(ctx, args) {
        let installation = await ctx.db
            .query('installations')
            .withIndex('by_installationId', (q) => q.eq('installationId', args.installationId))
            .unique()

        if (installation) {
            await ctx.db.delete(installation._id)
        }
    },
})

export const setInstallationSuspended = internalMutation({
    args: {
        installationId: v.string(),
        suspended: v.boolean(),
    },
    async handler(ctx, args) {
        let installation = await ctx.db
            .query('installations')
            .withIndex('by_installationId', (q) => q.eq('installationId', args.installationId))
            .unique()

        if (installation) {
            await ctx.db.patch(installation._id, { suspended: args.suspended })
        }
    },
})

export const fixRepoCounts = internalAction({
    async handler(ctx) {
        let repos = await ctx.runQuery(internal.functions.listAllRepos)
        for (const repo of repos) {
            let issues = await ctx.runQuery(api.functions.listIssues, {
                owner: repo.owner,
                repo: repo.repo,
            })
            if (!issues) {
                console.log(`No issues found for repo ${repo.owner}/${repo.repo}`)
                continue
            }

            let openIssues = issues.filter((issue) => issue.state === 'open')
            let closedIssues = issues.filter((issue) => issue.state === 'closed')

            await ctx.runMutation(internal.mutations.upsertRepoCounts, {
                repoId: repo._id,
                openIssues: openIssues.length,
                closedIssues: closedIssues.length,
                openPullRequests: 0,
                closedPullRequests: 0,
            })
        }
    },
})

async function addInstallationMutation(
    ctx: MutationCtx,
    args: {
        userId: Id<'users'>
        repoId: Id<'repos'>
        installationId: string
    },
) {
    let existing = await ctx.db
        .query('installations')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .filter((i) => i.eq(i.field('repoId'), args.repoId))
        .unique()
    if (!existing) {
        await ctx.db.insert('installations', {
            installationId: args.installationId,
            userId: args.userId,
            repoId: args.repoId,
            suspended: false,
        })
    }
}

async function upsertRepoMutation(
    ctx: MutationCtx,
    args: { owner: string; repo: string; private: boolean },
) {
    let existing = await ctx.db
        .query('repos')
        .filter((r) => r.eq(r.field('owner'), args.owner) && r.eq(r.field('repo'), args.repo))
        .unique()
    if (existing) {
        await ctx.db.patch(existing._id, { private: args.private })
        return existing._id
    } else {
        let repoId = await ctx.db.insert('repos', args)
        await ctx.db.insert('repoCounts', {
            repoId,
            openIssues: 0,
            closedIssues: 0,
            openPullRequests: 0,
            closedPullRequests: 0,
        })
        return repoId
    }
}

export const upsertRepoCounts = internalMutation({
    args: {
        repoId: v.id('repos'),
        openIssues: v.number(),
        closedIssues: v.number(),
        openPullRequests: v.number(),
        closedPullRequests: v.number(),
    },
    async handler(ctx, args) {
        let existing = await ctx.db
            .query('repoCounts')
            .withIndex('by_repoId', (q) => q.eq('repoId', args.repoId))
            .unique()
        if (existing) {
            await ctx.db.patch(existing._id, args)
        } else {
            await ctx.db.insert('repoCounts', args)
        }
    },
})
