import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { err, ok, wrap } from '@convex/shared'
import { SECRET, logger, octoCatch } from '@convex/utils'
import { Buffer } from 'buffer'
import type { Octokit } from 'octokit'
import { getAllRefs } from './github'

export type UpdateCfg = {
    ctx: ActionCtx
    octo: Octokit
    savedRepo: Doc<'repos'>
    since?: string
    isBackfill: boolean
}

export async function updateCommits(cfg: UpdateCfg): R {
    let { octo, ctx, savedRepo } = cfg
    let owner = savedRepo.owner
    let repo = savedRepo.repo

    let allCommits = octo.paginate.iterator(octo.rest.repos.listCommits, {
        owner,
        repo,
        since: cfg.since,
        per_page: 100,
    })

    let writtenTrees = new Map<string, Id<'trees'>>()
    let writtenTreeEntries = new Map<string, Id<'treeEntries'>>()
    let writtenCommits = new Map<string, Id<'commits'>>()

    logger.info('updating commits')

    let totalCommitsWritten = 0
    for await (let { data: commitsPage } of allCommits) {
        for (let commit of commitsPage) {
            let isWritten = await isCommitWritten(cfg, commit)
            if (isWritten) {
                logger.debug({ sha: commit.sha }, 'commit already written')
                continue
            }

            logger.debug({ sha: commit.sha }, 'processing commit')

            let rootTreeSha = commit.commit.tree.sha

            let treeData = await getTreeData(cfg, rootTreeSha)
            if (treeData.isErr) {
                return wrap(`failed to get tree for commit ${commit.sha}`, treeData)
            }

            let treeId = writtenTrees.get(rootTreeSha)
            if (!treeId) {
                let treeDoc = await ctx.runMutation(api.models.trees.getOrCreate, {
                    ...SECRET,
                    repoId: savedRepo._id,
                    sha: rootTreeSha,
                })
                if (treeDoc) writtenTrees.set(rootTreeSha, treeDoc._id)
            }

            let commitId = writtenCommits.get(commit.sha)
            if (!commitId) {
                let commitDoc = await ctx.runMutation(api.models.commits.getOrCreate, {
                    ...SECRET,
                    repoId: savedRepo._id,
                    treeSha: rootTreeSha,
                    message: commit.commit.message,
                    parentShas: commit.parents.map((p) => p.sha),
                    sha: commit.sha,
                    author: commit.commit.author ?? undefined,
                    committer: commit.commit.committer ?? undefined,
                })
                if (commitDoc) writtenCommits.set(commit.sha, commitDoc._id)
            }

            for (let treeEntry of treeData.val.tree) {
                let existingTreeEntryId = writtenTreeEntries.get(treeEntry.sha)
                if (existingTreeEntryId) continue

                let processRes = await updateTreeEntry(cfg, treeEntry, rootTreeSha)
                if (processRes.isErr) {
                    return wrap('failed to process tree entry', processRes)
                }

                if (processRes.val) {
                    writtenTreeEntries.set(treeEntry.sha, processRes.val._id)

                    if (cfg.isBackfill) {
                        let res = await updateDownload(
                            cfg,
                            'backfilling',
                            `added ${treeEntry.path}`,
                        )
                        if (res.isErr) return res
                    }
                }

                let abort = await shouldAbort(cfg)
                if (abort.isErr) return abort
            }

            totalCommitsWritten++
            if (cfg.isBackfill) {
                let res = await updateDownload(
                    cfg,
                    'backfilling',
                    `${totalCommitsWritten} commits written`,
                )
                if (res.isErr) return res
            }

            let abort = await shouldAbort(cfg)
            if (abort.isErr) return abort
        }
    }

    logger.info('commits updated')

    return ok()
}

export async function updateIssues(cfg: UpdateCfg): R {
    let { octo, ctx, savedRepo } = cfg
    let owner = savedRepo.owner
    let repo = savedRepo.repo
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

    logger.info('updating issues')

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

            logger.debug({ issue: issue.number }, 'processing issue')

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

                logger.debug({ issue: issue.number }, 'processing comments for issue')

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
            if (cfg.isBackfill) {
                let res = await updateDownload(
                    cfg,
                    'backfilling',
                    `${totalIssuesWritten} issues written`,
                )
                if (res.isErr) return res
            }

            let abort = await shouldAbort(cfg)
            if (abort.isErr) return abort
        }
    }

    logger.info('issues updated')

    return ok()
}

type TreeEntry = {
    path: string
    mode: string
    type: string
    sha: string
    size?: number
    url?: string
}

async function updateTreeEntry(cfg: UpdateCfg, treeEntry: TreeEntry, rootTreeSha: string) {
    logger.debug({ treeEntry: treeEntry.path }, 'processing tree entry')

    let newTreeEntry
    if (treeEntry.type === 'blob') {
        let blob = await octoCatch(
            cfg.octo.rest.git.getBlob({
                owner: cfg.savedRepo.owner,
                repo: cfg.savedRepo.repo,
                file_sha: treeEntry.sha,
            }),
        )
        if (blob.isErr) {
            return err(`failed to get blob: ${blob.err.error()}`)
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
        } catch {
            storedContent = blobContentBase64 ?? ''
            storedEncoding = 'base64'
        }

        newTreeEntry = await cfg.ctx.runMutation(api.models.treeEntries.getOrCreate, {
            ...SECRET,
            entrySha: treeEntry.sha,
            entryType: 'blob' as const,
            mode: treeEntry.mode,
            path: treeEntry.path,
            rootTreeSha: rootTreeSha,
            repoId: cfg.savedRepo._id,
        })

        await cfg.ctx.runMutation(api.models.blobs.upsert, {
            ...SECRET,
            repoId: cfg.savedRepo._id,
            sha: treeEntry.sha,
            content: storedContent,
            encoding: storedEncoding,
            size: blobSize,
        })
    } else if (treeEntry.type === 'tree') {
        newTreeEntry = await cfg.ctx.runMutation(api.models.treeEntries.getOrCreate, {
            ...SECRET,
            repoId: cfg.savedRepo._id,
            rootTreeSha: rootTreeSha,
            entrySha: treeEntry.sha,
            entryType: 'tree' as const,
            mode: treeEntry.mode,
            path: treeEntry.path,
        })

        await cfg.ctx.runMutation(api.models.trees.getOrCreate, {
            ...SECRET,
            repoId: cfg.savedRepo._id,
            sha: treeEntry.sha,
        })
    }

    return ok(newTreeEntry)
}

export async function updateRefs(cfg: UpdateCfg, defaultBranch: string): R {
    let { octo, savedRepo, ctx } = cfg
    let owner = savedRepo.owner
    let repo = savedRepo.repo

    let refs = await getAllRefs(octo, { owner, repo })
    if (refs.isErr) return wrap('failed to get refs', refs)

    let mapped = refs.val.map((r) => ({ repoId: savedRepo._id, ...r }))
    await ctx.runMutation(api.models.refs.replaceRepoRefs, {
        ...SECRET,
        repoId: savedRepo._id,
        refs: mapped,
    })

    await ctx.runMutation(api.models.repos.setHead, {
        ...SECRET,
        repoId: savedRepo._id,
        headRefName: defaultBranch,
    })

    let abort = await shouldAbort(cfg)
    if (abort.isErr) return abort

    return ok()
}

async function isCommitWritten({ ctx, savedRepo }: UpdateCfg, commit: { sha: string }) {
    let savedCommit = await ctx.runQuery(api.models.commits.getByRepoAndSha, {
        ...SECRET,
        repoId: savedRepo._id,
        sha: commit.sha,
    })
    return !!savedCommit
}

type TreeData = Awaited<ReturnType<Octokit['rest']['git']['getTree']>>['data']

async function getTreeData(
    { octo, savedRepo: { owner, repo } }: UpdateCfg,
    rootTreeSha: string,
): R<TreeData> {
    let treeData
    treeData = octo.rest.git.getTree({
        owner,
        repo,
        tree_sha: rootTreeSha,
        recursive: 'true',
    })
    treeData = await octoCatch(treeData)
    if (treeData.isErr) {
        return err(`failed to get tree: ${treeData.err.error()}`)
    }

    if (treeData.val.truncated) {
        return err('tree too big to process: truncated')
    }

    return treeData
}

export async function shouldAbort({ savedRepo, ctx }: UpdateCfg): R {
    let download = await ctx.runQuery(api.models.repoDownloads.getByRepoId, {
        ...SECRET,
        repoId: savedRepo._id,
    })
    if (!download) {
        return err(`download not found for repo: ${savedRepo.owner}/${savedRepo.repo}`)
    }

    if (download.status === 'cancelled') {
        return err('sync for repo was cancelled, we should abort')
    }

    return ok()
}

export async function updateDownload(
    cfg: { ctx: ActionCtx; savedRepo: Doc<'repos'> },
    status: Doc<'repoDownloads'>['status'],
    message: string,
) {
    let res = await cfg.ctx.runMutation(api.models.repoDownloads.upsertIfNotCancelled, {
        ...SECRET,
        repoId: cfg.savedRepo._id,
        status,
        message,
    })
    if (res.isErr) return res

    logger.debug(`DOWNLOAD PROGRESS UPDATE: ${message}`)

    return ok()
}
