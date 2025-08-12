import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { SECRET, err, octoCatch, ok, wrap } from '@convex/utils'
import { Buffer } from 'buffer'
import { Octokit } from 'octokit'
import { getAllRefs } from './github'

type InstallRepoCfg = {
    ctx: ActionCtx
    githubUserId: number
    installationId: number
    repo: string
    owner: string
    private: boolean
}

export async function installRepoService(cfg: InstallRepoCfg): R {
    let { ctx, githubUserId, installationId, repo, owner } = cfg
    let user = await ctx.runQuery(api.models.authAccounts.getByProviderAndAccountId, {
        ...SECRET,
        githubUserId,
    })
    if (!user) {
        return err('user not found')
    }
    let userId = user.userId

    let savedRepo = await ctx.runMutation(api.models.repos.getOrCreate, {
        ...SECRET,
        owner,
        repo,
        private: cfg.private,
    })
    if (!savedRepo) {
        return err('failed to create repo')
    }

    let updateCfg = { ...cfg, savedRepo }

    await updateDownloadStatus(updateCfg, 'pending', 'Starting repository installation')

    let token = await ctx.runAction(api.nodeActions.createGithubInstallationToken, {
        ...SECRET,
        repoId: savedRepo._id,
        userId,
        githubInstallationId: installationId,
    })
    if (token.isErr) {
        await updateDownloadStatus(updateCfg, 'error', 'Failed to create installation token')
        return wrap('failed to create installation token', token)
    }

    await updateDownloadStatus(updateCfg, 'pending', 'Created installation token')

    let octo = new Octokit({ auth: token })

    console.log(`${owner}/${repo}: starting initial backfill`)
    let backfill = await runBackfill({
        ...cfg,
        octo,
        owner,
        repo,
        savedRepo,
    })
    if (backfill.isErr) {
        await updateDownloadStatus(updateCfg, 'error', 'Failed to backfill refs')
        return wrap('sync repo failed', backfill)
    }

    await updateDownloadStatus(updateCfg, 'success', 'Backfill complete')

    return ok()
}

type SyncRepoConfig = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
    savedRepo: Doc<'repos'>
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

async function runBackfill(cfg: SyncRepoConfig): R {
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

    let refsRes = await getAllRefs(octo, { owner, repo })
    if (refsRes.isErr) {
        return wrap('failed to get refs', refsRes)
    }

    let refs = refsRes.val.map((r) => ({ repoId: savedRepo._id, ...r }))
    await ctx.runMutation(api.models.refs.replaceRepoRefs, {
        ...SECRET,
        repoId: savedRepo._id,
        refs,
    })

    await ctx.runMutation(api.models.repos.setHead, {
        ...SECRET,
        repoId: savedRepo._id,
        headRefName: repoData.val.default_branch,
    })

    console.log('upserted refs')

    await updateDownloadStatus(cfg, 'pending', 'Backfilled refs, downloading commits')

    console.log('backfilling commits')

    let commitsRes = await backfillCommits(cfg)
    if (commitsRes.isErr) {
        return wrap('failed to backfill commits', commitsRes)
    }

    await updateDownloadStatus(cfg, 'pending', 'Backfilled commits, downloading issues')
    await backfillIssues(cfg)

    return ok()
}

async function backfillCommits(cfg: SyncRepoConfig) {
    let { octo, owner, repo, ctx, savedRepo } = cfg
    let repoId = savedRepo._id

    let allCommits = octo.paginate.iterator(octo.rest.repos.listCommits, {
        owner,
        repo,
        per_page: 100,
    })

    let writtenTrees = new Map<string, Id<'trees'>>()
    let writtenTreeEntries = new Map<string, Id<'treeEntries'>>()
    let writtenCommits = new Map<string, Id<'commits'>>()

    let totalCommitsWritten = 0
    for await (let { data: commitsPage } of allCommits) {
        for (let commit of commitsPage) {
            let isCommitWritten = await ctx.runQuery(api.models.commits.getByRepoAndSha, {
                ...SECRET,
                repoId,
                sha: commit.sha,
            })
            if (isCommitWritten) {
                console.log('commit already written', commit.sha)
                continue
            }

            console.log(`processing commit ${commit.sha}`)

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

            console.log('got tree data')

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

            console.log('processing tree entries')

            for (let treeEntry of treeData.val.tree) {
                console.log('processing tree entry', treeEntry.path)
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

    return ok()
}

async function backfillIssues(cfg: SyncRepoConfig) {
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

    for await (let { data: issuesPage } of issuesIterator) {
        for (let issue of issuesPage) {
            console.log('processing issue', issue.number)

            let labels: string[] = []
            for (let label of issue.labels ?? []) {
                if (typeof label === 'string') labels.push(label)
                else if (label.name) labels.push(label.name)
            }

            let issueState: 'open' | 'closed'
            if (issue.state === 'closed' || issue.state === 'open') issueState = issue.state
            else continue

            let issueDoc = await ctx.runMutation(api.models.issues.getOrCreate, {
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

                console.log('processing comments for issue', issue.number)

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

    console.log('upserting sync state')

    if (lastIssueUpdated) {
        await ctx.runMutation(api.models.syncStates.upsert, {
            ...SECRET,
            repoId,
            issuesSince: lastIssueUpdated,
        })
    }
    if (lastCommentUpdated) {
        await ctx.runMutation(api.models.syncStates.upsert, {
            ...SECRET,
            repoId,
            commentsSince: lastCommentUpdated,
        })
    }

    console.log('sync state upserted')
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
        console.log('fetching blob', treeEntry.path)

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

        console.log('storing blob', treeEntry.path)

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
        console.log('storing tree', treeEntry.path)

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
