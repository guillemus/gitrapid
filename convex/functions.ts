import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import {
    internalMutation,
    internalQuery,
    query,
    type MutationCtx,
    type QueryCtx,
} from './_generated/server'
import { getUserId, parseRefAndPath } from './utils'

export const getRepo = internalQuery({
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

export const getAllRepos = internalQuery({
    async handler(ctx) {
        return ctx.db.query('repos').collect()
    },
})

export const getRepoRefs = internalQuery({
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

export const getRefAndPath = internalQuery({
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

export const insertRepo = internalMutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
        head: v.optional(v.id('refs')),
    },
    async handler(ctx, args) {
        return ctx.db.insert('repos', args)
    },
})

export const getFiles = internalQuery({
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

export const urlWithFilenames = internalQuery({
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

export const getRefs = internalQuery({
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
        await getUserId(ctx)

        let savedRepo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), owner) && r.eq(r.field('repo'), repo))
            .first()
        if (!savedRepo) {
            return null
        }

        let commitIdAndRefs = await getCommitIdFromRef(ctx, savedRepo._id, refAndPath)
        if (!commitIdAndRefs) {
            return null
        }

        return commitIdAndRefs
    },
})

export const separateRefFromPath = internalQuery({
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

export const commitIdFromPath = internalQuery({
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

export const filesAndCommitIdFromPath = internalQuery({
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

export const getRepoAndRefs = internalQuery({
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

export const insertFilenames = internalMutation({
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

export const insertCommit = internalMutation({
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
            .first()

        if (saved) {
            await ctx.db.patch(saved._id, { content })
            return saved._id
        }
        return await ctx.db.insert('files', { repo: repoId, commit: commitId, filename, content })
    },
})

// fixme: getRepoPage is too complex? There might be better ways to do this

export const getRepoPage = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        // await getUserId(ctx)

        let savedRepo = await ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (r) => r.eq('owner', owner).eq('repo', repo))
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

        let currentRef: string
        let commitId: Id<'commits'>
        if (parsed.ref === 'HEAD') {
            let headRef = refs.find((ref) => ref._id === savedRepo.head)
            if (headRef) {
                currentRef = headRef.ref
                commitId = headRef.commit
            } else {
                console.log(`getRepoPage: head not found - owner: ${owner}, repo: ${repo}`)
                return null
            }
        } else {
            let ref = refs.find((r) => r.ref === parsed.ref)
            if (!ref) {
                console.error(
                    `getRepoPage: ref not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}`,
                )
                return null
            }

            currentRef = ref.ref
            commitId = ref.commit
        }

        let fileContentsP = ctx.db
            .query('files')
            .withIndex('by_repo_and_commit', (f) =>
                f.eq('repo', savedRepo._id).eq('commit', commitId),
            )
            .filter((f) => f.eq(f.field('filename'), parsed.path))
            .first()

        let filenames = await ctx.db
            .query('filenames')
            .withIndex('by_commit', (f) => f.eq('commit', commitId))
            .first()
        if (!filenames) {
            console.error(
                `getRepoPage: filenames not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}, path: ${parsed.path}`,
            )
            return null
        }

        let fileContents = await fileContentsP
        if (!fileContents) {
            console.error(
                `getRepoPage: file not found - owner: ${owner}, repo: ${repo}, ref: ${parsed.ref}, path: ${parsed.path}`,
            )
            return null
        }

        return {
            ref: currentRef,
            commitId,
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
        // await getUserId(ctx)

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
            .first()
        if (!repo) {
            return null
        }

        let existingToken = await ctx.db
            .query('installationAccessTokens')
            .withIndex('by_repo_id', (q) => q.eq('repoId', repo._id))
            .first()
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
        owner: v.string(),
        repo: v.string(),
        githubId: v.number(),
        number: v.number(),
        title: v.string(),
        state: v.string(),
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
        // Find the repo by owner and repo
        const repo = await ctx.db
            .query('repos')
            .filter((r) => r.eq(r.field('owner'), args.owner) && r.eq(r.field('repo'), args.repo))
            .first()
        if (!repo) throw new Error(`Repo not found: ${args.owner}/${args.repo}`)

        // Upsert the issue
        const existing = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) =>
                q.eq('repo', repo._id).eq('number', args.number),
            )
            .first()
        const issueData = {
            repo: repo._id,
            githubId: args.githubId,
            number: args.number,
            title: args.title,
            state: args.state,
            body: args.body,
            author: args.author,
            labels: args.labels,
            assignees: args.assignees,
            createdAt: args.createdAt,
            updatedAt: args.updatedAt,
            closedAt: args.closedAt,
            comments: args.comments,
        }
        if (existing) {
            await ctx.db.patch(existing._id, issueData)
        } else {
            await ctx.db.insert('issues', issueData)
        }
    },
})

async function upsertRepoMutation(
    ctx: MutationCtx,
    args: { owner: string; repo: string; private: boolean },
) {
    let existing = await ctx.db
        .query('repos')
        .filter((r) => r.eq(r.field('owner'), args.owner) && r.eq(r.field('repo'), args.repo))
        .first()
    if (existing) {
        await ctx.db.patch(existing._id, { private: args.private })
        return existing._id
    } else {
        return await ctx.db.insert('repos', args)
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

async function upsertUsersDataMutation(ctx: MutationCtx, args: { userId: Id<'users'> }) {
    let existing = await ctx.db
        .query('usersData')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .first()
    if (existing) return existing._id

    let inserted = await ctx.db.insert('usersData', { userId: args.userId })
    return inserted
}

export const upsertUsersData = internalMutation({
    args: {
        userId: v.id('users'),
    },
    async handler(ctx, args) {
        return await upsertUsersDataMutation(ctx, args)
    },
})

async function addInstallationMutation(
    ctx: MutationCtx,
    args: {
        userDataId: Id<'usersData'>
        repoId: Id<'repos'>
        installationId: string
    },
) {
    let existing = await ctx.db
        .query('installations')
        .withIndex('by_userDataId', (q) => q.eq('userDataId', args.userDataId))
        .filter((i) => i.eq(i.field('repoId'), args.repoId))
        .first()
    if (!existing) {
        await ctx.db.insert('installations', {
            installationId: args.installationId,
            userDataId: args.userDataId,
            repoId: args.repoId,
            suspended: false,
        })
    }
}

export const addInstallation = internalMutation({
    args: {
        userDataId: v.id('usersData'),
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
            .first()

        if (!authAccount) {
            console.log(`User with GitHub ID ${args.githubUserId} not found in auth system.`)
            return
        }

        let userDataId = await upsertUsersDataMutation(ctx, { userId: authAccount.userId })

        for (const repoData of args.repos) {
            const repoId = await upsertRepoMutation(ctx, repoData)

            await addInstallationMutation(ctx, {
                userDataId,
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
            .first()

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
            .first()

        if (installation) {
            await ctx.db.patch(installation._id, { suspended: args.suspended })
        }
    },
})

export const listInstalledRepos = query({
    async handler(ctx) {
        let userId = await getUserId(ctx)

        let usersDataId = await ctx.db
            .query('usersData')
            .withIndex('by_userId', (u) => u.eq('userId', userId))
            .first()
        if (!usersDataId) {
            console.log('No usersDataId found for user', userId)
            return null
        }

        let installations = await ctx.db
            .query('installations')
            .withIndex('by_userDataId', (i) => i.eq('userDataId', usersDataId._id))
            .collect()

        let repos
        repos = await Promise.all(installations.map((i) => ctx.db.get(i.repoId)))
        repos = repos.filter((r) => r !== null)

        return repos
    },
})

export const listIssues = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        search: v.optional(v.string()),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let usersDataId = await ctx.db
            .query('usersData')
            .withIndex('by_userId', (u) => u.eq('userId', userId))
            .first()

        if (!usersDataId) {
            console.log('No usersDataId found for user', userId)
            return null
        }

        let installations = await ctx.db
            .query('installations')
            .withIndex('by_userDataId', (i) => i.eq('userDataId', usersDataId._id))
            .collect()

        let repo = await ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (r) => r.eq('owner', args.owner).eq('repo', args.repo))
            .first()
        if (!repo) {
            console.log('No repo found for user', userId)
            return null
        }

        let repoId = installations.find((i) => i.repoId === repo._id)?.repoId
        if (!repoId) {
            console.log('No repoId found for user', userId)
            return null
        }

        let issues
        issues = ctx.db.query('issues')
        if (args.search) {
            let search = args.search
            issues = issues.withSearchIndex('search_issues', (i) =>
                i.search('title', search).eq('repo', repoId),
            )
        } else {
            issues = issues.withIndex('by_repo_and_number', (i) => i.eq('repo', repoId))
        }

        issues = await issues.collect()

        return issues
    },
})

export const getIssueWithComments = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        issueNumber: v.number(),
    },
    async handler(ctx, args) {
        let userId = await getUserId(ctx)

        let usersDataId = await ctx.db
            .query('usersData')
            .withIndex('by_userId', (u) => u.eq('userId', userId))
            .first()

        if (!usersDataId) {
            console.log('No usersDataId found for user', userId)
            return null
        }

        let installations = await ctx.db
            .query('installations')
            .withIndex('by_userDataId', (i) => i.eq('userDataId', usersDataId._id))
            .collect()

        let repo = await ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (r) => r.eq('owner', args.owner).eq('repo', args.repo))
            .first()
        if (!repo) {
            console.log('No repo found for user', userId)
            return null
        }

        let repoId = installations.find((i) => i.repoId === repo._id)?.repoId
        if (!repoId) {
            console.log('No repoId found for user', userId)
            return null
        }

        let issue = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (i) =>
                i.eq('repo', repoId).eq('number', args.issueNumber),
            )
            .first()
        if (!issue) {
            console.log('No issue found for user', userId)
            return null
        }

        let comments = await ctx.db
            .query('issueComments')
            .withIndex('by_issue', (c) => c.eq('issueId', issue._id))
            .collect()

        return {
            issue,
            comments,
        }
    },
})
