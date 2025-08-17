import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { SECRET, logger, octoCatch, protectedAction } from '@convex/utils'
import { Buffer } from 'buffer'
import { Octokit } from 'octokit'
import { getAllRefs } from './github'
import { v } from 'convex/values'

export const run = protectedAction({
    args: {
        token: v.string(),
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        let octo = new Octokit({ auth: args.token })
        let res = await runRepoBackfill({ ctx, octo, ...args })
        unwrap(res)
    },
})

type BackfillCfg = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
    private: boolean
}

type BackfillCfgWithRepo = BackfillCfg & {
    savedRepo: Doc<'repos'>
}

async function updateDownloadStatus(
    cfg: BackfillCfgWithRepo,
    status: 'pending' | 'success' | 'error',
    message: string,
) {
    await cfg.ctx.runMutation(api.models.repoDownloadStatus.upsert, {
        ...SECRET,
        repoId: cfg.savedRepo._id,
        status,
        message,
    })
}

async function runRepoBackfill(cfg: BackfillCfg): R {
    let { ctx, octo } = cfg

    let savedRepo = await ctx.runMutation(api.models.models.insertNewRepo, {
        ...SECRET,
        owner: cfg.owner,
        repo: cfg.repo,
        private: cfg.private,
    })
    if (!savedRepo) return err('Failed to save repo')

    let owner = savedRepo.owner
    let repo = savedRepo.repo

    let repoData = await octoCatch(octo.rest.repos.get({ owner, repo }))
    if (repoData.isErr) {
        let isUnauthorized = repoData.err.status === 401
        let badCredentials = repoData.err.error().includes('Bad credentials')
        if (isUnauthorized && badCredentials) {
            return err('bad credentials')
        }
        return err(`failed to get repo: ${repoData.err.error()}`)
    }

    let cfgWithRepo = { ...cfg, savedRepo }

    await updateDownloadStatus(cfgWithRepo, 'pending', 'Backfilling refs')

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

    await updateDownloadStatus(cfgWithRepo, 'pending', 'Backfilled refs, downloading commits')

    logger.info('backfilling commits')

    let commitsRes = await backfillCommits(cfgWithRepo, savedRepo)
    if (commitsRes.isErr) {
        return wrap('failed to backfill commits', commitsRes)
    }

    await updateDownloadStatus(cfgWithRepo, 'pending', 'Backfilled commits, downloading issues')
    await backfillIssues(cfgWithRepo, savedRepo)

    return ok()
}

async function backfillCommits(cfg: BackfillCfgWithRepo, savedRepo: Doc<'repos'>) {
    let { octo, ctx, owner, repo } = cfg

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
                repoId: savedRepo._id,
                sha: commit.sha,
            })
            if (isCommitWritten) {
                logger.debug({ sha: commit.sha }, 'commit already written')
                continue
            }

            logger.debug({ sha: commit.sha }, 'processing commit')

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
                return err(`failed to get tree: ${treeData.err.error()}`)
            }

            if (treeData.val.truncated) {
                return err('tree too big to process: truncated')
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
                    sha: commit.sha,
                    author: commit.commit.author ?? undefined,
                    committer: commit.commit.committer ?? undefined,
                })
                if (commitDoc) writtenCommits.set(commit.sha, commitDoc._id)
            }

            for (let treeEntry of treeData.val.tree) {
                let existingTreeEntryId = writtenTreeEntries.get(treeEntry.sha)
                if (existingTreeEntryId) continue

                let processRes = await processTreeEntry(cfg, treeEntry, rootTreeSha)
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

async function backfillIssues(cfg: BackfillCfgWithRepo, savedRepo: Doc<'repos'>) {
    let { octo, ctx } = cfg
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
    cfg: BackfillCfgWithRepo,
    treeEntry: TreeEntry,
    rootTreeSha: string,
) {
    logger.debug({ treeEntry: treeEntry.path }, 'processing tree entry')

    let newTreeEntry
    if (treeEntry.type === 'blob') {
        let blob = await octoCatch(
            cfg.octo.rest.git.getBlob({
                owner: cfg.owner,
                repo: cfg.repo,
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
        } catch (_) {
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
