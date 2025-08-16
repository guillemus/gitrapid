import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { SECRET, logger, octoCatch } from '@convex/utils'
import { Buffer } from 'buffer'
import { Octokit } from 'octokit'
import { getAllRefs } from './github'
import { err, ok, wrap } from '../shared'

type InstallRepoCfg = {
    ctx: ActionCtx
    githubUserId: number
    githubInstallationId: number
    repo: string
    owner: string
    private: boolean
}

async function updateDownloadStatus(
    cfg: {
        ctx: ActionCtx
        savedRepo: Doc<'repos'>
    },
    status: 'pending' | 'success' | 'error',
    message: string,
) {
    let { ctx, savedRepo } = cfg
    await ctx.runMutation(api.models.repoDownloadStatus.upsert, {
        ...SECRET,
        repoId: savedRepo._id,
        status,
        message,
    })
}

type BackfillConfig = InstallRepoCfg & {
    octo: Octokit
    savedRepo: Doc<'repos'>
}

async function runBackfill(cfg: BackfillConfig) {
    let { ctx, octo, owner, repo, savedRepo } = cfg

    let repoData = await octoCatch(octo.rest.repos.get({ owner, repo }))
    if (repoData.isErr) {
        let isUnauthorized = repoData.error.status === 401
        let badCredentials = repoData.error.error().includes('Bad credentials')
        if (isUnauthorized && badCredentials) {
            return err('bad credentials')
        }
        return err(`failed to get repo: ${repoData.error.error()}`)
    }

    await updateDownloadStatus(cfg, 'pending', 'Backfilling refs')

    let refs = await getAllRefs(octo, { owner, repo })
    if (refs.isErr) {
        return wrap('failed to get refs', refs)
    }

    let mapped = refs.val.map((r) => ({ repoId: savedRepo._id, ...r }))
    await ctx.runMutation(api.models.refs.replaceRepoRefs, {
        ...SECRET,
        repoId: savedRepo._id,
        refs: mapped,
    })

    await ctx.runMutation(api.models.repos.setHead, {
        ...SECRET,
        repoId: savedRepo._id,
        headRefName: repoData.val.default_branch,
    })

    logger.info('upserted refs')

    await updateDownloadStatus(cfg, 'pending', 'Backfilled refs, downloading commits')

    logger.info('backfilling commits')

    let commitsRes = await backfillCommits(cfg)
    if (commitsRes.isErr) {
        return wrap('failed to backfill commits', commitsRes)
    }

    await updateDownloadStatus(cfg, 'pending', 'Backfilled commits, downloading issues')
    await backfillIssues(cfg)

    return ok()
}

async function backfillCommits(cfg: BackfillConfig) {
    let { octo, owner, repo, ctx, savedRepo } = cfg
    let repoId = savedRepo._id

    let allCommits = octo.paginate.iterator(octo.rest.repos.listCommits, {
        owner,
        repo,
        per_page: 1,
    })

    let writtenTrees = new Map<string, Id<'trees'>>()
    let writtenTreeEntries = new Map<string, Id<'treeEntries'>>()
    let writtenCommits = new Map<string, Id<'commits'>>()

    logger.info('backfilling commits')

    let totalCommitsWritten = 0
    for await (let { data: commitsPage } of allCommits) {
        for (let commit of commitsPage) {
            let isCommitWritten = await ctx.runQuery(api.models.commits.getByRepoAndSha, {
                ...SECRET,
                repoId,
                sha: commit.sha,
            })
            if (isCommitWritten) {
                logger.info({ sha: commit.sha }, 'commit already written')
                continue
            }

            logger.info(`processing commit ${commit.sha}`)

            let rootTreeSha = commit.commit.tree.sha

            let treeData
            treeData = octo.rest.git.getTree({
                owner,
                repo,
                tree_sha: rootTreeSha,
                recursive: 'true',
            })
            treeData = await octoCatch(treeData)
            if (treeData.isErr) {
                return err(`failed to get tree: ${treeData.error.error()}`)
            }

            if (treeData.val.truncated) {
                return err('tree too big to process: truncated')
            }

            let treeId = writtenTrees.get(rootTreeSha)
            if (!treeId) {
                let treeDoc = await ctx.runMutation(api.models.trees.getOrCreate, {
                    ...SECRET,
                    repoId,
                    sha: rootTreeSha,
                })
                if (treeDoc) writtenTrees.set(rootTreeSha, treeDoc._id)
            }

            let commitId = writtenCommits.get(commit.sha)
            if (!commitId) {
                let commitDoc = await ctx.runMutation(api.models.commits.getOrCreate, {
                    ...SECRET,
                    repoId,
                    treeSha: rootTreeSha,
                    message: commit.commit.message,
                    sha: commit.sha,
                    author: commit.commit.author ?? undefined,
                    committer: commit.commit.committer ?? undefined,
                })
                if (commitDoc) writtenCommits.set(commit.sha, commitDoc._id)
            }

            for (let treeEntry of treeData.val.tree) {
                let existingTreeEntryId = writtenTreeEntries.get(treeEntry.sha)
                if (existingTreeEntryId) continue

                let processRes = await processTreeEntry(
                    { ctx, octo, owner, repo },
                    treeEntry,
                    rootTreeSha,
                    repoId,
                )
                if (processRes.isErr) {
                    return wrap('failed to process tree entry', processRes)
                }

                if (processRes.val) {
                    writtenTreeEntries.set(treeEntry.sha, processRes.val._id)
                }
            }

            totalCommitsWritten++
            await updateDownloadStatus(cfg, 'pending', `${totalCommitsWritten} commits written`)
        }
    }

    logger.info('commits backfilled')

    return ok()
}

async function backfillIssues(cfg: BackfillConfig) {
    let { octo, owner, repo, ctx, savedRepo } = cfg
    let repoId = savedRepo._id

    let issuesIterator = octo.paginate.iterator(octo.rest.issues.listForRepo, {
        owner,
        repo,
        per_page: 100,
        state: 'all',
    })

    let lastIssueUpdated: string | undefined
    let lastCommentUpdated: string | undefined

    let totalIssuesWritten = 0

    logger.info('backfilling issues')

    for await (let { data: issuesPage } of issuesIterator) {
        for (let issue of issuesPage) {
            let labels: string[] = []
            for (let label of issue.labels ?? []) {
                if (typeof label === 'string') labels.push(label)
                else if (label.name) labels.push(label.name)
            }

            let issueState: 'open' | 'closed'
            if (issue.state === 'closed' || issue.state === 'open') issueState = issue.state
            else continue

            let issueDoc = await ctx.runMutation(api.models.models.getOrCreateIssue, {
                ...SECRET,
                repoId,
                githubId: issue.id,
                number: issue.number,
                title: issue.title,
                state: issueState,
                body: issue.body ?? undefined,
                author: { login: issue.user?.login ?? '', id: issue.user?.id ?? 0 },
                labels,
                assignees: issue.assignees?.map((a) => a.login) ?? undefined,
                createdAt: issue.created_at,
                updatedAt: issue.updated_at,
                closedAt: issue.closed_at ?? undefined,
                comments: issue.comments ?? undefined,
            })
            if (!issueDoc) continue

            let issueId = issueDoc._id
            if (!lastIssueUpdated || issue.updated_at > lastIssueUpdated) {
                lastIssueUpdated = issue.updated_at
            }

            if (issue.comments && issue.comments > 0) {
                let commentsIter = octo.paginate.iterator(octo.rest.issues.listComments, {
                    owner,
                    repo,
                    issue_number: issue.number,
                    per_page: 100,
                })

                logger.info({ issue: issue.number }, 'processing comments for issue')

                for await (let { data: commentsPage } of commentsIter) {
                    for (let comment of commentsPage) {
                        await ctx.runMutation(api.models.issueComments.getOrCreate, {
                            ...SECRET,
                            issueId,
                            githubId: comment.id,
                            author: {
                                login: comment.user?.login ?? '',
                                id: comment.user?.id ?? 0,
                            },
                            body: comment.body ?? '',
                            createdAt: comment.created_at,
                            updatedAt: comment.updated_at,
                        })
                        if (!lastCommentUpdated || comment.updated_at > lastCommentUpdated) {
                            lastCommentUpdated = comment.updated_at
                        }
                    }
                }
            }

            totalIssuesWritten++
            await updateDownloadStatus(cfg, 'pending', `${totalIssuesWritten} issues written`)
        }
    }

    logger.info('issues backfilled')
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
    cfg: { ctx: ActionCtx; octo: Octokit; owner: string; repo: string },
    treeEntry: TreeEntry,
    rootTreeSha: string,
    repoId: Id<'repos'>,
) {
    let { ctx, octo, owner, repo } = cfg

    let newTreeEntry
    if (treeEntry.type === 'blob') {
        let blob = await octoCatch(octo.rest.git.getBlob({ owner, repo, file_sha: treeEntry.sha }))
        if (blob.isErr) {
            return err(`failed to get blob: ${blob.error.error()}`)
        }

        let blobContentBase64 = blob.val.content
        let blobSize = blob.val.size ?? 0

        let storedContent: string
        let storedEncoding: 'utf-8' | 'base64'
        try {
            let decoded = Buffer.from(blobContentBase64 ?? '', 'base64')
            let asUtf8 = decoded.toString('utf8')
            let reencoded = Buffer.from(asUtf8, 'utf8')
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

        newTreeEntry = await ctx.runMutation(api.models.treeEntries.getOrCreate, {
            ...SECRET,
            entrySha: treeEntry.sha,
            entryType: 'blob' as const,
            mode: treeEntry.mode,
            path: treeEntry.path,
            rootTreeSha: rootTreeSha,
            repoId,
        })

        await ctx.runMutation(api.models.blobs.upsert, {
            ...SECRET,
            repoId,
            sha: treeEntry.sha,
            content: storedContent,
            encoding: storedEncoding,
            size: blobSize,
        })
    } else if (treeEntry.type === 'tree') {
        newTreeEntry = await ctx.runMutation(api.models.treeEntries.getOrCreate, {
            ...SECRET,
            repoId,
            rootTreeSha: rootTreeSha,
            entrySha: treeEntry.sha,
            entryType: 'tree' as const,
            mode: treeEntry.mode,
            path: treeEntry.path,
        })

        await ctx.runMutation(api.models.trees.getOrCreate, {
            ...SECRET,
            repoId,
            sha: treeEntry.sha,
        })
    }

    return ok(newTreeEntry)
}
