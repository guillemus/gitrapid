import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { addSecret, err, failure, octoCatch, ok } from '@convex/utils'
import type { Octokit } from '@octokit/rest'
import { Buffer } from 'buffer'
import { getAllRefs } from './github'

type DownloadRepoConfig = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
    overrideCommits?: boolean
}

export async function downloadRepo(cfg: DownloadRepoConfig) {
    let { ctx, octo, owner, repo } = cfg

    console.log(`${owner}/${repo}: Validating repository`)

    let repoResult = await validateRepo(octo, { owner, repo })
    if (repoResult.error) {
        return repoResult.error
    }

    console.log(`${owner}/${repo}: Processing repository`)

    const repoDoc = await ctx.runMutation(
        api.protected.getOrCreateRepo,
        addSecret({ owner, repo, private: false }),
    )
    if (!repoDoc) {
        return err(`${owner}/${repo}: Failed to upsert repo`)
    }

    const repoId = repoDoc._id
    console.log(`${owner}/${repo}: Upserted repo with ID: ${repoId}`)

    console.log(`${owner}/${repo}: Getting default branch`)

    let repoMeta = await octoCatch(octo.repos.get({ owner, repo }))
    if (repoMeta.error) {
        return failure({
            code: 'repo-get-failed',
            message: repoMeta.error.message,
        })
    }
    const defaultBranch = repoMeta.data.default_branch

    console.log(`${owner}/${repo}: Getting all refs`)
    let refs = await getAllRefs(octo, { owner, repo })
    if (refs.error) {
        return err(`${owner}/${repo}: Failed to get refs: ${refs.error.message}`)
    }

    let upsertRefDocs = refs.data.map((r) => ({
        repoId,
        isTag: r.isTag,
        name: r.name,
        commitSha: r.commitSha,
    }))
    await ctx.runMutation(api.protected.upsertRefs, addSecret({ refs: upsertRefDocs }))

    // Set the repo head to the default branch
    await ctx.runMutation(
        api.protected.setRepoHead,
        addSecret({ repoId, headRefName: defaultBranch }),
    )

    console.log(`${owner}/${repo}: Downloading commits`)
    await downloadCommits(cfg, repoId)
    console.log(`${owner}/${repo}: Commit download complete`)

    console.log(`${owner}/${repo}: Downloading issues`)
    await downloadIssues(cfg, repoId)
    console.log(`${owner}/${repo}: Issue download complete`)

    return ok({ repoId })
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
            return err(`${owner}/${repo}: Failed to get blob: ${blob.error.message}`)
        }

        let blobData = blob.data
        let blobContentBase64 = blobData.content
        let blobSize = blobData.size ?? 0

        // GitHub returns base64 via API. Decode to UTF-8 if the bytes are valid UTF-8; otherwise keep base64.
        let storedContent: string
        let storedEncoding: 'utf-8' | 'base64'
        try {
            const decoded = Buffer.from(blobContentBase64 ?? '', 'base64')
            const asUtf8 = decoded.toString('utf8')
            const reencoded = Buffer.from(asUtf8, 'utf8')
            if (decoded.equals(reencoded)) {
                storedContent = asUtf8
                storedEncoding = 'utf-8'
            } else {
                storedContent = blobContentBase64 ?? ''
                storedEncoding = 'base64'
            }
        } catch (_) {
            storedContent = blobContentBase64 ?? ''
            storedEncoding = 'base64'
        }

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
            api.protected.upsertBlob,
            addSecret({
                repoId,
                sha: treeEntry.sha,
                content: storedContent,
                encoding: storedEncoding,
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

    return ok(newTreeEntry)
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

async function downloadCommits(cfg: DownloadRepoConfig, repoId: Id<'repos'>) {
    let { octo, owner, repo, ctx } = cfg

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
            if (isCommitWritten && !cfg.overrideCommits) {
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
                const treeDoc = await ctx.runMutation(
                    api.protected.getOrCreateTree,
                    addSecret({ repoId, sha: rootTreeSha }),
                )
                if (treeDoc) writtenTrees.set(rootTreeSha, treeDoc._id)
            }

            let commitId = writtenCommits.get(commit.sha)
            if (!commitId) {
                const commitDoc = await ctx.runMutation(
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
                if (commitDoc) writtenCommits.set(commit.sha, commitDoc._id)
            }

            for (let treeEntry of githubTree.tree) {
                console.log(`${owner}/${repo}: Processing tree entry: ${treeEntry.path}`)

                let treeEntryId = writtenTreeEntries.get(treeEntry.sha)
                if (treeEntryId) {
                    continue
                }

                let newTreeEntry = await processTreeEntry(cfg, treeEntry, rootTreeSha, repoId)
                if (newTreeEntry.error) {
                    console.error(
                        `${owner}/${repo}: Failed to process tree entry: ${treeEntry.path}`,
                        newTreeEntry.error,
                    )
                    continue
                }
                if (!newTreeEntry.data) {
                    console.error(`${owner}/${repo}: No tree entry created for ${treeEntry.path}`)
                    continue
                }

                writtenTreeEntries.set(treeEntry.sha, newTreeEntry.data._id)
            }
        }
    }
}

async function downloadIssues(cfg: DownloadRepoConfig, repoId: Id<'repos'>) {
    let { octo, owner, repo, ctx } = cfg

    const issuesIterator = octo.paginate.iterator(octo.rest.issues.listForRepo, {
        owner,
        repo,
        per_page: 100,
        state: 'all',
    })

    for await (const { data: issuesPage } of issuesIterator) {
        for (const issue of issuesPage) {
            console.log(`${owner}/${repo}: Processing issue: ${issue.number}`)

            // Build labels
            let labels: string[] = []
            for (let label of issue.labels ?? []) {
                if (typeof label === 'string') {
                    labels.push(label)
                } else if (label.name) {
                    labels.push(label.name)
                }
            }

            const assignees = issue.assignees?.map((a) => a.login) ?? undefined

            let issueState: 'open' | 'closed'
            if (issue.state === 'closed' || issue.state === 'open') {
                issueState = issue.state
            } else {
                console.error(`${owner}/${repo}: Unknown issue state: ${issue.state}`)
                continue
            }

            const issueArgs = {
                repoId,
                githubId: issue.id,
                number: issue.number,
                title: issue.title,
                state: issueState,
                body: issue.body ?? undefined,
                author: {
                    login: issue.user?.login ?? 'ghost',
                    id: issue.user?.id ?? 0,
                },
                labels,
                assignees,
                createdAt: issue.created_at,
                updatedAt: issue.updated_at,
                closedAt: issue.closed_at ?? undefined,
                comments: issue.comments ?? undefined,
            }

            const issueDoc = await ctx.runMutation(
                api.protected.getOrCreateIssue,
                addSecret(issueArgs),
            )
            if (!issueDoc) continue
            const issueId = issueDoc._id

            if (issue.comments > 0) {
                console.log(`${owner}/${repo}: Processing ${issue.comments} comments`)

                const commentsIter = octo.paginate.iterator(octo.rest.issues.listComments, {
                    owner,
                    repo,
                    issue_number: issue.number,
                    per_page: 100,
                })

                for await (const { data: commentsPage } of commentsIter) {
                    for (const comment of commentsPage) {
                        const commentArgs = {
                            issueId,
                            githubId: comment.id,
                            author: {
                                login: comment.user?.login ?? 'ghost',
                                id: comment.user?.id ?? 0,
                            },
                            body: comment.body ?? '',
                            createdAt: comment.created_at,
                            updatedAt: comment.updated_at,
                        }

                        await ctx.runMutation(
                            api.protected.getOrCreateIssueComment,
                            addSecret(commentArgs),
                        )
                    }
                }
            }
        }
    }
}
