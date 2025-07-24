import { v } from 'convex/values'
import { GithubClient } from './GithubClient'
import { api } from './_generated/api'
import { action } from './_generated/server'
import { downloadAllRefs } from './utils'

// fixme: bad bad
let githubClient = new GithubClient(process.env.GITHUB_TOKEN)

export const fetchFileFromGithub = action({
    args: {
        owner: v.string(),
        repo: v.string(),
        ref: v.string(),
        path: v.string(),
        commitId: v.id('commits'),
    },
    async handler(ctx, { owner, repo, ref, path, commitId }) {
        let fileRes = await githubClient.getFileContentByAPI(owner, repo, path, ref)
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

        let contents = atob(fileRes.data.content)

        await ctx.runMutation(api.functions.insertFileContents, {
            commitId,
            contents,
            path,
        })

        return 'ok' as const
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
