import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internalQuery, query, type QueryCtx } from './_generated/server'
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

// fixme: getRepoPage is too complex? There might be better ways to do this

export const getRepoPage = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        await getUserId(ctx)

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
        await getUserId(ctx)

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

export const listInstalledRepos = query({
    async handler(ctx) {
        let userId = await getUserId(ctx)

        let user = await ctx.db.get(userId)
        if (!user) {
            console.log('No user found for user', userId)
            return null
        }

        let installations = await ctx.db
            .query('installations')
            .withIndex('by_userId', (i) => i.eq('userId', userId))
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

        let user = await ctx.db.get(userId)
        if (!user) {
            console.log('No user found for user', userId)
            return null
        }

        let installations = await ctx.db
            .query('installations')
            .withIndex('by_userId', (i) => i.eq('userId', userId))
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

        let installations = await ctx.db
            .query('installations')
            .withIndex('by_userId', (i) => i.eq('userId', userId))
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

export const getInstallationToken = internalQuery({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    async handler(ctx, args) {
        let repo = await ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (r) => r.eq('owner', args.owner).eq('repo', args.repo))
            .first()
        if (!repo) {
            return null
        }

        let installationToken = await ctx.db
            .query('installationAccessTokens')
            .withIndex('by_repo_id', (i) => i.eq('repoId', repo._id))
            .first()
        if (!installationToken) {
            return null
        }

        return installationToken
    },
})

export const listAllRepos = internalQuery({
    async handler(ctx) {
        return await ctx.db.query('repos').collect()
    },
})
