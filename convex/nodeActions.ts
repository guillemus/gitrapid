'use node'

import { Octokit } from '@octokit/rest'
import type { WithoutSystemFields } from 'convex/server'
import { v } from 'convex/values'
import * as git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import { fs } from 'memfs'
import { api, internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { internalAction, type ActionCtx } from './_generated/server'
import { createGithubAppJwt } from './jwt'
import { addSecret, batchTreeFiles, MAX_FILE_SIZE, tryCatch, validateRepo } from './utils'

export const logGithubAppJwt = internalAction({
    async handler() {
        let token = createGithubAppJwt()
        console.log(token)
    },
})

export const generateGithubAppInstallationToken = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo }): Promise<string> {
        let savedRepo = await ctx.runQuery(internal.queries.getRepo, {
            owner,
            repo,
        })
        if (!savedRepo) {
            throw new Error('Repo not found')
        }

        let existingToken = await ctx.runQuery(internal.queries.getInstallationToken, {
            repoId: savedRepo._id,
        })
        if (!existingToken) {
            throw new Error('No installation token found')
        }

        // If the token expires in more than 5 minutes, return it
        const expiresAt = new Date(existingToken.expiresAt)
        const nowPlus5Min = new Date(Date.now() + 1000 * 60 * 5)
        if (expiresAt > nowPlus5Min) {
            return existingToken.token
        }

        let token = createGithubAppJwt()
        let octo = new Octokit({ auth: token })

        let installation = await octo.apps.getRepoInstallation({ owner, repo })
        let installationId = installation.data.id

        let accessToken = await octo.apps.createInstallationAccessToken({
            installation_id: installationId,
        })

        await ctx.runMutation(internal.mutations.saveInstallationToken, {
            owner,
            repo,
            token: accessToken.data.token,
            expiresAt: accessToken.data.expires_at,
        })

        console.log('github app jwt', token)
        console.log('installation token', accessToken.data.token)

        return accessToken.data.token
    },
})

export const downloadPublicRepoCommitsWithGitClone = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, args) {
        return downloadPublicRepoCommitsWithGitCloneAction(ctx, args)
    },
})

export async function downloadPublicRepoCommitsWithGitCloneAction(
    ctx: ActionCtx,
    args: {
        owner: string
        repo: string
    },
) {
    console.log('starting clone', args)
    console.time('clone time')

    const repoDir = '/tmp/repository'
    const gitDir = '/tmp/repository/.git'

    let pat = await ctx.runQuery(api.protected.getFirstPat, addSecret({}))
    if (!pat) {
        throw new Error('PAT not found')
    }

    let octo = new Octokit({ auth: pat.token })

    let repo = await validateRepo(octo, args)
    if (repo.error) {
        throw repo.error
    }

    await git.clone({
        fs,
        http,
        dir: repoDir,
        url: `https://github.com/${args.owner}/${args.repo}.git`,
        onAuth() {
            return {
                username: pat.token,
                password: '',
            }
        },
        onAuthSuccess: (url, auth) => {
            console.log('Auth successful for:', url)
        },
        onAuthFailure: (url, auth) => {
            console.log('Auth failed for:', url)
            return { cancel: true } // This will throw an error
        },
    })
    console.timeEnd('clone time')

    console.log('clone done')

    let repoSlug = `${args.owner}/${args.repo}`

    // Get repo ID
    let repoId = await ctx.runMutation(
        api.protected.upsertRepo,
        addSecret({
            owner: args.owner,
            repo: args.repo,
            private: false,
        }),
    )

    console.log(`${repoSlug}: downloading commits with isomorphic-git`)

    // Get all commits using git.log
    let commits = await git.log({
        fs,
        dir: repoDir,
        depth: undefined, // Get all commits
    })

    console.log(`${repoSlug}: found ${commits.length} commits`)

    // Process commits in reverse order (oldest first) to match GitHub API behavior
    for (let i = commits.length - 1; i >= 0; i--) {
        let commit = commits[i]
        if (!commit) {
            continue
        }

        console.log(`${repoSlug}/${commit.oid}: downloading commit ${i + 1}/${commits.length}`)

        let commitId = await ctx.runMutation(
            api.protected.upsertCommit,
            addSecret({ repoId, sha: commit.oid }),
        )

        console.log(`${repoSlug}/${commit.oid}: reading tree`)

        // Read the tree for this commit
        let treeResult = await git.readTree({
            fs,
            gitdir: gitDir,
            oid: commit.commit.tree,
        })

        let tree = treeResult.tree

        console.log(
            `${repoSlug}/${commit.oid}: got tree with ${tree.length} entries, processing files`,
        )

        // Filter only files (blobs) and extract filenames
        let fileEntries = tree.filter((entry) => entry.type === 'blob')
        let filenames = fileEntries.map((entry) => entry.path)

        await ctx.runMutation(
            api.protected.insertFilenames,
            addSecret({ commitId, fileList: filenames }),
        )

        // Convert tree entries to our TreeFile format for batching
        let treeFiles = fileEntries.map((entry) => ({
            path: entry.path,
            mode: entry.mode,
            type: entry.type,
            sha: entry.oid,
            size: undefined, // We don't have size info from tree, will handle during download
        }))

        let batches = batchTreeFiles(treeFiles)

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            let batch = batches[batchIndex]
            if (!batch) {
                continue
            }

            console.log(
                `${repoSlug}/${commit.oid}: processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} files`,
            )

            let ps = batch.map(async (treeFile) => {
                console.log(`${repoSlug}/${commit.oid}: downloading file ${treeFile.path}`)

                // Read blob content
                let blobResult = await tryCatch(
                    git.readBlob({
                        fs,
                        gitdir: gitDir,
                        oid: treeFile.sha,
                    }),
                )
                if (blobResult.error) {
                    console.error(
                        `${repoSlug}/${commit.oid}: error downloading file ${treeFile.path}:`,
                        blobResult.error,
                    )
                    return
                }

                let content = Buffer.from(blobResult.data.blob).toString('base64')
                let size = blobResult.data.blob.length

                // If file is too large, don't store content, we'll make sure to
                // include link on interface.
                if (size > MAX_FILE_SIZE) {
                    content = ''
                }

                let fileDoc: WithoutSystemFields<Doc<'files'>> = {
                    commit: commitId,
                    repo: repoId,
                    filename: treeFile.path,
                    value: {
                        type: 'file',
                        content,
                        encoding: 'base64',
                        size,
                        url: `https://github.com/${args.owner}/${args.repo}/blob/${commit.oid}/${treeFile.path}`,
                        download_url: `https://raw.githubusercontent.com/${args.owner}/${args.repo}/${commit.oid}/${treeFile.path}`,
                        git_url: undefined,
                        html_url: `https://github.com/${args.owner}/${args.repo}/blob/${commit.oid}/${treeFile.path}`,
                    },
                }

                await ctx.runMutation(api.protected.insertFile, addSecret(fileDoc))
            })

            await Promise.allSettled(ps)
        }
    }

    console.log(`${repoSlug}: finished downloading all commits`)
}
