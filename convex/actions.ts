import { v } from 'convex/values'
import { GithubClient } from '../src/pages/shared/github-client'
import { api } from './_generated/api'
import { action } from './_generated/server'
import { downloadAllRefs, parseRefAndPath } from './utils'

// fixme: bad bad
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

        let parsed = parseRefAndPath(new Set(refs.map((ref) => ref.ref)), refAndPath)
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
