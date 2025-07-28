import { v } from 'convex/values'
import { GithubClient } from '../src/shared/githubClient'
import { api, internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { parseRefAndPath } from './utils'

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
    },
})

export const updateHead = action({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo }) {
        console.log('processing repo', owner, repo)

        let savedRepo = await ctx.runQuery(api.functions.getRepo, {
            owner,
            repo,
        })
        if (!savedRepo) {
            console.error(`repo not found`, owner, repo)
            return
        }

        let repoInfo = await githubClient.getRepo(savedRepo.owner, savedRepo.repo)
        if (repoInfo.error) {
            console.error(repoInfo.error)
            return
        }

        console.log('getting main ref for', savedRepo.owner, savedRepo.repo)
        let mainRef = await githubClient.getBranchRef(
            savedRepo.owner,
            savedRepo.repo,
            repoInfo.data.default_branch,
        )
        if (mainRef.error) {
            console.error(mainRef.error)
            return
        }

        let commitSha = mainRef.data.object.sha

        console.log('main ref sha', commitSha)
        let treeRes = await githubClient.getRepoTree(savedRepo.owner, savedRepo.repo, commitSha)
        if (treeRes.error) {
            console.error(treeRes.error)
            return
        }

        let commitId = await ctx.runMutation(api.functions.insertCommit, {
            repoId: savedRepo._id,
            sha: commitSha,
        })

        let fileList = treeRes.data.tree.map((f) => f.path)

        console.log('inserting filenames for', commitId)
        await ctx.runMutation(api.functions.insertFilenames, { commitId, fileList })

        for (let file of fileList) {
            console.log('getting file', file)
            let fileRes = await githubClient.getFileContentByAPI(
                savedRepo.owner,
                savedRepo.repo,
                commitSha,
                file,
            )
            if (fileRes.error) {
                console.error(fileRes.error)
                continue
            }

            if (Array.isArray(fileRes.data)) {
                console.error('file is directory', file)
                continue
            }
            if (fileRes.data.type !== 'file') {
                console.error('file is not a file', file)
                continue
            }

            let fileContent = atob(fileRes.data.content)

            console.log('inserting file', file)
            await ctx.runMutation(api.functions.insertFile, {
                repoId: savedRepo._id,
                commitId: commitId,
                filename: file,
                content: fileContent,
            })
        }

        await ctx.runMutation(api.functions.updateRepoHead, {
            repoId: savedRepo._id,
            head: commitId,
        })
    },
})

export const updateRateLimit = internalMutation({
    args: {
        limit: v.number(),
        used: v.number(),
        remaining: v.number(),
        reset: v.string(),
    },
    async handler(ctx, { limit, used, remaining, reset }) {
        let rateLimit = {
            limit,
            used,
            remaining,
            reset,
        }

        let existingRateLimit = await ctx.db.query('appRateLimit').first()
        if (existingRateLimit) {
            await ctx.db.replace(existingRateLimit._id, rateLimit)
            return
        }

        await ctx.db.insert('appRateLimit', rateLimit)
    },
})

export const checkRateLimit = action({
    async handler(ctx) {
        let rateLimits = await githubClient.checkRateLimits()
        if (rateLimits.error) {
            throw rateLimits.error
        }

        const resetMs = rateLimits.data.resources.core.reset * 1000
        const nowMs = Date.now()
        const diffMs = resetMs - nowMs
        const minutes = Math.round(diffMs / (1000 * 60))

        await ctx.runMutation(internal.actions.updateRateLimit, {
            limit: rateLimits.data.resources.core.limit,
            used: rateLimits.data.resources.core.used,
            remaining: rateLimits.data.resources.core.remaining,
            reset: `in ${minutes} minute${minutes === 1 ? '' : 's'}`,
        })
    },
})
