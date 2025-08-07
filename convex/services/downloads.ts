import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { addSecret, failure, octoCatch, ok } from '@convex/utils'
import type { Octokit } from '@octokit/rest'

type DownloadRepoConfig = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
}

export async function downloadRepo(cfg: DownloadRepoConfig) {
    let { ctx, octo, owner, repo } = cfg

    console.log(`${owner}/${repo}: Validating repository`)

    let repoResult = await validateRepo(octo, { owner, repo })
    if (repoResult.error) {
        console.error('Error validating repo:', repoResult.error)
        return
    }

    console.log(`${owner}/${repo}: Processing repository`)

    const repoId = await ctx.runMutation(
        api.protected.getOrCreateRepo,
        addSecret({ owner, repo, private: false }),
    )
    console.log(`${owner}/${repo}: Upserted repo with ID: ${repoId}`)

    console.log(`${owner}/${repo}: Getting default branch`)

    const { data: repoData } = await octo.repos.get({
        owner,
        repo,
    })
    const defaultBranch = repoData.default_branch

    const { data: refData } = await octo.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
    })
    const commitSha = refData.object.sha

    console.log(`${owner}/${repo}: Getting all refs`)

    let upsertRefDocs = await getAllRefs(cfg, repoId)

    await ctx.runMutation(api.protected.upsertRefs, addSecret({ refs: upsertRefDocs }))

    console.log(`${owner}/${repo}: Latest commit on ${defaultBranch}: ${commitSha.slice(0, 7)}`)

    let allCommits = octo.paginate.iterator(octo.rest.repos.listCommits, {
        owner,
        repo,
        per_page: 100,
    })

    let writtenTrees = new Map<string, Id<'trees'>>()
    let writtenTreeEntries = new Map<string, Id<'treeEntries'>>()
    let writtenCommits = new Map<string, Id<'commits'>>()

    for await (const { data: commitsPage } of allCommits) {
        for (const commit of commitsPage) {
            let isCommitWritten = await ctx.runMutation(
                api.protected.isCommitWritten,
                addSecret({ repoId, sha: commit.sha }),
            )
            if (isCommitWritten) {
                console.log(`${owner}/${repo}: Commit ${commit.sha.slice(0, 7)} already written`)
                continue
            }

            console.log(`${owner}/${repo}: Processing commit: ${commit.sha.slice(0, 7)}`)
            let rootTreeSha = commit.commit.tree.sha

            let githubTree
            githubTree = octo.git.getTree({
                owner,
                repo,
                tree_sha: rootTreeSha,
                recursive: 'true',
            })
            githubTree = await octoCatch(githubTree)
            if (githubTree.error) {
                console.error('Error fetching tree:', githubTree.error)
                continue
            }

            githubTree = githubTree.data
            if (githubTree.truncated) {
                // fixme: we should somehow download the tree in another way
                throw new Error('Tree too big to process: GitHub tree is truncated')
            }

            let treeId = writtenTrees.get(rootTreeSha)
            if (!treeId) {
                treeId = await ctx.runMutation(
                    api.protected.getOrCreateTree,
                    addSecret({ repoId, sha: rootTreeSha }),
                )
                writtenTrees.set(rootTreeSha, treeId)
            }

            let commitId = writtenCommits.get(commit.sha)
            if (!commitId) {
                commitId = await ctx.runMutation(
                    api.protected.getOrCreateCommit,
                    addSecret({
                        repoId,
                        treeSha: rootTreeSha,
                        message: commit.commit.message,
                        sha: commit.sha,
                        author: commit.commit.author ?? undefined,
                        committer: commit.commit.committer ?? undefined,
                    }),
                )
                writtenCommits.set(commit.sha, commitId)
            }

            for (let treeEntry of githubTree.tree) {
                console.log(`${owner}/${repo}: Processing tree entry: ${treeEntry.path}`)

                let treeEntryId = writtenTreeEntries.get(treeEntry.sha)
                if (treeEntryId) {
                    continue
                }

                let newTreeEntry = await processTreeEntry(cfg, treeEntry, rootTreeSha, repoId)
                if (newTreeEntry) {
                    writtenTreeEntries.set(treeEntry.sha, newTreeEntry)
                }
            }
        }
    }
}

type TreeEntry = {
    path: string
    mode: string
    type: string
    sha: string
    size?: number
    url?: string
}

async function processTreeEntry(
    cfg: DownloadRepoConfig,
    treeEntry: TreeEntry,
    rootTreeSha: string,
    repoId: Id<'repos'>,
) {
    let { ctx, octo, owner, repo } = cfg

    let newTreeEntry
    if (treeEntry.type === 'blob') {
        let blob
        blob = octo.git.getBlob({
            owner,
            repo,
            file_sha: treeEntry.sha,
        })
        blob = await octoCatch(blob)
        if (blob.error) {
            console.error('Error fetching blob:', blob.error)
            return
        }

        let blobData = blob.data
        let blobContent = blobData.content
        let blobEncoding = blobData.encoding
        let blobSize = blobData.size ?? 0

        // fixme: we should check if the blob is too big (convex doesn't like > 1mb docs)
        // fixme: 2 mutations could be 1 instead

        newTreeEntry = await ctx.runMutation(
            api.protected.getOrCreateTreeEntry,
            addSecret({
                entrySha: treeEntry.sha,
                entryType: 'blob' as const,
                mode: treeEntry.mode,
                path: treeEntry.path,
                rootTreeSha: rootTreeSha,
                repoId,
            }),
        )

        await ctx.runMutation(
            api.protected.getOrCreateBlob,
            addSecret({
                repoId,
                sha: treeEntry.sha,
                content: blobContent,
                encoding: blobEncoding,
                size: blobSize,
            }),
        )
    } else if (treeEntry.type === 'tree') {
        newTreeEntry = await ctx.runMutation(
            api.protected.getOrCreateTreeEntry,
            addSecret({
                repoId,
                rootTreeSha: rootTreeSha,
                entrySha: treeEntry.sha,
                entryType: 'tree' as const,
                mode: treeEntry.mode,
                path: treeEntry.path,
            }),
        )

        await ctx.runMutation(
            api.protected.getOrCreateTree,
            addSecret({
                repoId,
                sha: treeEntry.sha,
            }),
        )
    }

    return newTreeEntry
}

/**
 * Checks whether:
 * - The given octokit instance has a valid token
 * - The repository is public
 * - The repository has a license that allows us to store the code.
 */
async function validateRepo(octo: Octokit, args: { owner: string; repo: string }) {
    let repoSlug = `${args.owner}/${args.repo}`

    let repo
    repo = await octoCatch(octo.rest.repos.get(args))
    if (repo.error) {
        let isUnauthorized = repo.error.status === 401
        let badCredentials = repo.error.message.includes('Bad credentials')

        if (isUnauthorized && badCredentials) {
            return failure('bad-credentials')
        }

        return repo
    }

    console.log(`${repoSlug}: token is valid`)

    repo = repo.data

    // if repo is private the user has probably made a mistake. This is probably
    // not possible if we've done a good job with the PATs.

    if (repo.private) {
        return failure('private-repo')
    }

    console.log(`${repoSlug}: repo is public, checking license`)

    // check license, can we store the code?
    let license
    license = await octoCatch(octo.rest.licenses.getForRepo({ owner: args.owner, repo: args.repo }))
    if (license.error) {
        if (license.error.status === 404) {
            return failure('license-not-found')
        }

        return license
    }

    license = license.data

    let spdxId = license.license?.spdx_id
    if (!spdxId) {
        return failure('license-not-found')
    }
    if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
        return failure(new ErrLicenseNotSupported(spdxId))
    }

    console.log(`${repoSlug}: license ${spdxId} is supported`)

    return ok(repo)
}

class ErrLicenseNotSupported {
    constructor(public spdxId: string) {}
}

async function getAllRefs(cfg: DownloadRepoConfig, repoId: Id<'repos'>) {
    let { octo, owner, repo } = cfg

    let allBranches
    allBranches = await octo.rest.git.listMatchingRefs({ owner, repo, ref: 'heads' })
    allBranches = allBranches.data.map((ref) => ({
        repoId,
        isTag: false,
        name: ref.ref.replace('refs/heads/', ''),
        commitSha: ref.object.sha,
    }))

    let allTags
    allTags = await octo.rest.git.listMatchingRefs({ owner, repo, ref: 'tags' })
    allTags = allTags.data.map((ref) => ({
        repoId,
        isTag: true,
        name: ref.ref.replace('refs/tags/', ''),
        commitSha: ref.object.sha,
    }))

    return [...allBranches, ...allTags]
}
