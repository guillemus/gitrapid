import dotenv from 'dotenv'

import { GithubClient } from '@/pages/shared/github-client'
import { type Context } from '@convex/utils'
import { ConvexHttpClient } from 'convex/browser'
import simpleGit from 'simple-git'
import { api } from '@convex/_generated/api'

dotenv.config()
dotenv.config({ override: true, path: '.env.local' })

const convexClient = new ConvexHttpClient(process.env.CONVEX_URL!)
const githubClient = new GithubClient(process.env.GITHUB_TOKEN)

let ctx: Context = {
    runQuery(query, ...args) {
        return convexClient.query(query, ...args)
    },
    runMutation(mutation, ...args) {
        return convexClient.mutation(mutation, ...args)
    },
}

// await downloadAllRefs(ctx, githubClient, 'facebook', 'react')

async function downloadMyRepo(ctx: Context) {
    let git = simpleGit()

    const repo = await ctx.runQuery(api.functions.getRepoAndRefs, {
        owner: 'alarbada',
        repo: 'gitrapid.com',
    })
    if (!repo) {
        console.error('Repo not found')
        return
    }

    console.log(`downloading ${repo.repo.owner}/${repo.repo.repo}`)
    const repoId = repo.repo._id

    // Get all commits in the repository
    const log = await git.log()
    const commits = log.all

    for (const commit of commits) {
        console.log(`downloading commit ${commit.hash}`)
        const commitHash = commit.hash
        const files = await git.raw(['ls-tree', '-r', '--name-only', commitHash])
        const fileList = files.split('\n').filter(Boolean)

        console.log(`inserting commit ${commitHash}`)
        const commitId = await ctx.runMutation(api.functions.insertCommit, {
            repoId: repoId,
            sha: commitHash,
        })

        console.log(`inserting filenames for commit ${commitHash}`)
        await ctx.runMutation(api.functions.insertFilenames, {
            commitId: commitId,
            fileList,
        })

        // Insert files 30 by 30 (in batches)
        for (let i = 0; i < fileList.length; i += 30) {
            const batch = fileList.slice(i, i + 30).map((file) => ({ filename: file, content: '' }))
            await ctx.runMutation(api.functions.insertFiles, {
                repoId: repoId,
                commitId: commitId,
                files: batch,
            })
        }
    }
}

downloadMyRepo(ctx)
