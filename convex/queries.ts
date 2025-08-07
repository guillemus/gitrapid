import { v } from 'convex/values'
import { internalQuery, query } from './_generated/server'
import {
    Blobs,
    Commits,
    getUserInstallationToken,
    Installations,
    Issues,
    Refs,
    Repos,
    TreeEntries,
    Trees,
} from './models/models'
import { parseRefAndPath } from './services/repoPageService'
import { parseUserId } from './utils'

export const getRepo = internalQuery({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    handler: async (ctx, args) => {
        return Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
    },
})

export const getRepoPage = query({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        await parseUserId(ctx)

        // fixme: block unauthorized access from user

        let savedRepo = await Repos.getByOwnerAndRepo(ctx, owner, repo)
        if (!savedRepo) {
            throw new Error(`getRepoPage: repo not found - owner: ${owner}, repo: ${repo}`)
        }
        let repoId = savedRepo._id

        let refs = await Refs.getRefsFromRepo(ctx, repoId)
        let headRef = refs.find((ref) => ref._id === savedRepo.headId)
        if (!headRef) {
            throw new Error(`getRepoPage: head ref not found - owner: ${owner}, repo: ${repo}`)
        }

        let parsedRefAndPath = parseRefAndPath(refs, headRef, refAndPath)
        if (!parsedRefAndPath) {
            throw new Error(
                `getRepoPage: error parsing ref and path - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        let commit = await Commits.getByRepoAndSha(ctx, repoId, parsedRefAndPath.ref.commitSha)
        if (!commit) {
            throw new Error(
                `getRepoPage: commit not found - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        let tree = await Trees.getByRepoAndSha(ctx, repoId, commit.treeSha)
        if (!tree) {
            throw new Error(
                `getRepoPage: tree not found - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        let treeEntries = await TreeEntries.getByRepoAndTree(ctx, repoId, tree.sha)
        let filenames = treeEntries.map((t) => t.path)

        return {
            ref: parsedRefAndPath.ref,
            path: parsedRefAndPath.path,
            filenames,
            repoId,
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
        let savedRepo = await Repos.getByOwnerAndRepo(ctx, owner, repo)
        if (!savedRepo) {
            throw new Error(`getRepoPage: repo not found - owner: ${owner}, repo: ${repo}`)
        }
        let repoId = savedRepo._id

        let refs = await Refs.getRefsFromRepo(ctx, repoId)
        let headRef = refs.find((ref) => ref._id === savedRepo.headId)
        if (!headRef) {
            throw new Error(`getRepoPage: head ref not found - owner: ${owner}, repo: ${repo}`)
        }

        let parsedRefAndPath = parseRefAndPath(refs, headRef, refAndPath)
        if (!parsedRefAndPath) {
            throw new Error(
                `getRepoPage: error parsing ref and path - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        let commit = await Commits.getByRepoAndSha(ctx, repoId, parsedRefAndPath.ref.commitSha)
        if (!commit) {
            throw new Error(
                `getRepoPage: commit not found - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        let tree = await Trees.getByRepoAndSha(ctx, repoId, commit.treeSha)
        if (!tree) {
            throw new Error(
                `getRepoPage: tree not found - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        let treeEntries = await TreeEntries.getByRepoAndTree(ctx, repoId, tree.sha)
        let treeEntry = treeEntries.find((t) => t.path === parsedRefAndPath.path)
        if (!treeEntry) {
            throw new Error(
                `getRepoPage: tree entry not found - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        let blob = await Blobs.getByRepoAndSha(ctx, repoId, treeEntry.entrySha)
        if (!blob) {
            throw new Error(
                `getRepoPage: blob not found - owner: ${owner}, repo: ${repo}, refAndPath: ${refAndPath}`,
            )
        }

        return blob.content
    },
})

export const listInstalledRepos = query({
    async handler(ctx) {
        let userId = await parseUserId(ctx)

        return Installations.listInstalledRepos(ctx, userId)
    },
})

export const listIssues = query({
    args: {
        repoId: v.id('repos'),
        search: v.optional(v.string()),
    },
    async handler(ctx, args) {
        let userId = await parseUserId(ctx)

        let installation = await Installations.getByUserIdAndRepoId(ctx, userId, args.repoId)
        if (!installation) {
            throw new Error('not authorized to these issues')
        }

        return Issues.listByRepo(ctx, args.repoId)
    },
})

export const getIssueWithComments = query({
    args: {
        repoId: v.id('repos'),
        issueNumber: v.number(),
    },
    async handler(ctx, args) {
        let userId = await parseUserId(ctx)

        let installation = await Installations.getByUserIdAndRepoId(ctx, userId, args.repoId)
        if (!installation) {
            throw new Error('not authorized to these issues')
        }

        let issue = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (i) =>
                i.eq('repoId', args.repoId).eq('number', args.issueNumber),
            )
            .unique()
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
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        return getUserInstallationToken(ctx, args.userId, args.repoId)
    },
})
