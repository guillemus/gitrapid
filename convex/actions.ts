import { v } from 'convex/values'
import { GithubClient } from '../src/pages/shared/github-client'
import { api } from './_generated/api'
import { Id } from './_generated/dataModel'
import { action } from './_generated/server'
import { downloadAllRefs, parseRefAndPath } from './utils'

async function withExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 4,
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            if (attempt === maxRetries - 1) {
                console.error(`BACKOFF: Operation failed after ${maxRetries} attempts:`, error)
                throw error
            }

            const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s, 8s
            console.log(`BACKOFF: Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error)
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }
    throw new Error('BACKOFF: Should not reach here')
}

// fixme: bad bad, no auth
let githubClient = new GithubClient(process.env.GITHUB_TOKEN)

export const fetchFileFromGithub = action({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let refs = await ctx.runQuery(api.functions.getRefs, {
            owner,
            repo,
        })

        let parsed = parseRefAndPath(
            refs.map((ref: any) => ref.ref),
            refAndPath,
        )
        if (!parsed) {
            console.error(`error parsing ref and path`, refAndPath)
            return null
        }

        let fileRes = await githubClient.getFileContentByAPI(owner, repo, parsed.ref, parsed.path)
        if (fileRes.error) {
            console.error(`error getting file`, fileRes.error)
            return null
        }

        if (Array.isArray(fileRes.data)) {
            console.info('file is directory')
            return null
        }

        if (fileRes.data.type !== 'file') {
            console.info('must be file')
            return null
        }

        return atob(fileRes.data.content)
    },
})

export const downloadRefs = action({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, args) {
        return downloadAllRefs(ctx, githubClient, args.owner, args.repo)
    },
})

type RepoPageResult = {
    ref: string
    commitId: Id<'commits'>
    repoId: Id<'repos'>
    refs: Array<{ ref: string; commit: string }>
    files?: string[]
    fileContents?: string
}

export const getRepoPage = action({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }): Promise<RepoPageResult | null> {
        let repoAndRefs = await ctx.runQuery(api.functions.getRepoAndRefs, {
            owner,
            repo,
        })
        if (!repoAndRefs) {
            console.error(`repo not found`, owner, repo)
            return null
        }

        let savedRepo = repoAndRefs.repo
        let refs = repoAndRefs.refs

        let refNames = refs.map((ref) => ref.ref)

        let parsed = parseRefAndPath(refNames, refAndPath)
        if (!parsed) {
            console.error(`error parsing ref and path`, refAndPath)
            return null
        }

        let ref = refs.find((r) => r.ref === parsed.ref)
        if (!ref) {
            console.error(`ref not found`, parsed.ref)
            return null
        }

        let fileP = githubClient.getFileContentByAPI(owner, repo, parsed.ref, parsed.path)

        let files = await ctx.runQuery(api.functions.getFiles, {
            commitId: ref.commit,
        })
        if (!files) {
            console.error(`error getting files for commit`, ref.commit)
            return null
        }

        let fileRes = await fileP
        if (fileRes.error) {
            console.error(`error getting file`, fileRes.error)
            return null
        }

        if (Array.isArray(fileRes.data)) {
            console.info('file is directory')
            return null
        }

        if (fileRes.data.type !== 'file') {
            console.info('must be file')
            return null
        }

        let fileContents = atob(fileRes.data.content)

        return {
            ref: ref.ref,
            commitId: ref.commit,
            fileContents,
            repoId: savedRepo._id,
            refs: refs,
            files: files?.files,
        }
    },
})

export const updateRepoRefs = action({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo: repoName }) {
        let savedRepo = await ctx.runQuery(api.functions.getRepo, {
            owner,
            repo: repoName,
        })
        if (!savedRepo) {
            console.error(`repo not found`, owner, repoName)
            return
        }

        let repoId = savedRepo._id

        let fetchedRefs: {
            sha: string
            ref: string
            isTag: boolean
        }[] = []

        let page = 0
        while (true) {
            console.log('fetching branches page', page, 'for', owner, repoName)

            let refs
            refs = await githubClient.listBranches(owner, repoName, page)
            if (refs.error) {
                throw refs.error
            }

            refs = refs.data

            if (refs.length === 0) {
                break
            }

            for (let ref of refs) {
                let sha = ref.commit.sha
                fetchedRefs.push({ sha, ref: ref.name, isTag: false })
            }

            page++
        }

        page = 0
        while (true) {
            console.log('fetching tags page', page, 'for', owner, repoName)

            let tags
            tags = await githubClient.listTags(owner, repoName, page)
            if (tags.error) {
                throw tags.error
            }

            tags = tags.data

            if (tags.length === 0) {
                break
            }

            for (let tag of tags) {
                let sha = tag.commit.sha
                fetchedRefs.push({ sha, ref: tag.name, isTag: true })
            }

            page++
        }

        console.log('upserting refs for', owner, repoName, fetchedRefs.length, 'refs')
        await ctx.runMutation(api.functions.upsertCommitsAndRefs, {
            repo: repoId,
            refs: fetchedRefs,
        })

        let commits = await ctx.runQuery(api.functions.getAllRepoCommitsWithoutFiles, {
            repoId: repoId,
        })

        for (let i = 0; i < commits.length; i++) {
            const commit = commits[i]!
            console.log(
                `processing commit ${i + 1}/${commits.length}: getting tree for`,
                owner,
                repoName,
                commit.sha,
            )
            let allFiles = await githubClient.getRepoTree(owner, repoName, commit.sha)
            if (allFiles.error) {
                console.error(allFiles.error)
                continue
            }

            let fileNames = allFiles.data.tree.map((f) => f.path)
            console.log('upserting', fileNames.length, 'files for commit', commit.sha)

            await ctx.scheduler.runAfter(0, api.functions.upsertFiles, {
                commitId: commit._id,
                fileNames: fileNames,
            })
        }
    },
})

export const insertFilenames = action({
    args: {
        owner: v.string(),
        repo: v.string(),
    },
    async handler(ctx, { owner, repo }) {
        let savedRepo = await ctx.runQuery(api.functions.getRepo, {
            owner,
            repo,
        })
        if (!savedRepo) {
            console.error(`repo not found`, owner, repo)
            return
        }

        let commits = await ctx.runQuery(api.functions.getAllRepoCommitsWithoutFiles, {
            repoId: savedRepo._id,
        })

        console.log(commits.length, 'commits without files for', owner, repo, commits.length)

        for (let i = 0; i < commits.length; i++) {
            const commit = commits[i]!
            console.log(
                `processing commit ${i + 1}/${commits.length}: getting tree for`,
                commit.sha,
            )
            let allFiles = await githubClient.getRepoTree(owner, repo, commit.sha)
            if (allFiles.error) {
                console.error(allFiles.error)
                continue
            }

            let fileNames = allFiles.data.tree.map((f) => f.path)
            console.log('upserting', fileNames.length, 'files for commit', commit.sha)

            await withExponentialBackoff(() =>
                ctx.runMutation(api.functions.upsertFiles, {
                    commitId: commit._id,
                    fileNames: fileNames,
                }),
            )
        }
    },
})
