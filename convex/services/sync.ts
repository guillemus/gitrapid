import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { SECRET, err, isErr, octoCatch, wrap } from '@convex/utils'
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

export async function installRepo(cfg: InstallRepoCfg) {
    let { ctx, githubUserId, installationId, repo, owner } = cfg
    let userId = await ctx.runQuery(api.protected.getUserIdFromGithubUserId, {
        ...SECRET,
        githubUserId,
    })
    if (!userId) {
        return err('user not found')
    }

    let createdRepo = await ctx.runMutation(api.protected.getOrCreateRepo, {
        ...SECRET,
        owner,
        repo,
        private: cfg.private,
    })
    if (!createdRepo) {
        return err('failed to create repo')
    }

    let token = await ctx.runAction(api.nodeActions.createGithubInstallationToken, {
        ...SECRET,
        repoId: createdRepo._id,
        userId,
        githubInstallationId: installationId,
    })
    if (isErr(token)) {
        return wrap('failed to create installation token', token)
    }

    let octo = new Octokit({ auth: token })

    let syncState = await ctx.runMutation(api.protected.getOrCreateSyncState, {
        ...SECRET,
        repoId: createdRepo._id,
    })
    if (!syncState) {
        return err('failed to get sync state')
    }

    console.log(`${owner}/${repo}: starting initial backfill`)
    let backfill = await runInitialBackfill(
        {
            ...cfg,
            octo,
        },
        createdRepo,
    )
    if (isErr(backfill)) {
        await ctx.runMutation(api.protected.upsertSyncState, {
            ...SECRET,
            repoId: createdRepo._id,
            syncError: backfill.error,
        })
        return wrap('sync repo failed', backfill)
    }

    await ctx.runMutation(api.protected.upsertSyncState, {
        ...SECRET,
        repoId: createdRepo._id,
        syncError: undefined,
        lastSuccessAt: new Date().toISOString(),
    })
}

type SyncRepoConfig = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
}

export async function syncRepo(cfg: SyncRepoConfig) {
    let { ctx, owner, repo } = cfg

    let savedRepo = await ctx.runQuery(api.protected.getRepo, {
        ...SECRET,
        owner: cfg.owner,
        repo: cfg.repo,
    })
    if (!savedRepo) {
        return err('repo not found')
    }

    let syncState = await ctx.runMutation(api.protected.getOrCreateSyncState, {
        ...SECRET,
        repoId: savedRepo._id,
    })
    if (!syncState) {
        return err('failed to get sync state')
    }

    let needsBackfill = !syncState.backfillDone
    let startedAt = Date.now()
    let result
    if (needsBackfill) {
        console.log(`${owner}/${repo}: starting initial backfill`)
        result = await runInitialBackfill(cfg, savedRepo)
        console.log(`${owner}/${repo}: initial backfill completed`)
    } else {
        console.log(`${owner}/${repo}: starting incremental sync`)
        result = await runIncrementalSync(cfg, savedRepo, syncState)
        console.log(`${owner}/${repo}: incremental sync completed`)
    }

    if (isErr(result)) {
        await ctx.runMutation(api.protected.upsertSyncState, {
            ...SECRET,
            repoId: savedRepo._id,
            syncError: result.error,
        })
        return wrap('sync repo failed', result)
    }

    await ctx.runMutation(api.protected.upsertSyncState, {
        ...SECRET,
        repoId: savedRepo._id,
        syncError: undefined,
        lastSuccessAt: new Date().toISOString(),
    })

    let durationMs = Date.now() - startedAt
    console.log(`${owner}/${repo}: sync success in ${durationMs}ms`)
}

async function runInitialBackfill(cfg: SyncRepoConfig, savedRepo: Doc<'repos'>) {
    let { ctx, octo, owner, repo } = cfg

    let repoData = await octoCatch(octo.rest.repos.get({ owner, repo }))
    if (isErr(repoData)) {
        let isUnauthorized = repoData.error.status === 401
        let badCredentials = repoData.error.error().includes('Bad credentials')
        if (isUnauthorized && badCredentials) {
            return err('bad credentials')
        }
        return err(`failed to get repo: ${repoData.error.error()}`)
    }

    let githubRefs = await getAllRefs(octo, { owner, repo })
    if (isErr(githubRefs)) {
        return wrap('failed to get githubRefs', githubRefs)
    }

    let refs = githubRefs.map((r) => ({ repoId: savedRepo._id, ...r }))
    await ctx.runMutation(api.protected.replaceRepoRefs, {
        ...SECRET,
        repoId: savedRepo._id,
        refs,
    })

    await ctx.runMutation(api.protected.setRepoHead, {
        ...SECRET,
        repoId: savedRepo._id,
        headRefName: repoData.default_branch,
    })

    console.log('upserted refs')

    if (!savedRepo.private) {
        console.log('validating license')
        let license = await validatePublicLicense(octo, { owner, repo })
        if (isErr(license)) return wrap('license validation failed', license)

        console.log('license validated')
    }

    console.log('backfilling commits')

    let commitsRes = await backfillCommits({ ...cfg, ctx, repoId: savedRepo._id })
    if (isErr(commitsRes)) {
        return wrap('failed to backfill commits', commitsRes)
    }

    console.log('backfilled commits')

    console.log('backfilling issues')
    await backfillIssues({ ...cfg, ctx, repoId: savedRepo._id })
    console.log('backfilled issues')

    // Seed since-cursors from the latest observed timestamps
    // We do this during backfill issues pass already, but ensure state here too.
    await ctx.runMutation(api.protected.upsertSyncState, {
        ...SECRET,
        repoId: savedRepo._id,
        backfillDone: true,
    })
}

async function runIncrementalSync(
    cfg: SyncRepoConfig,
    savedRepo: Doc<'repos'>,
    syncState: Doc<'syncStates'>,
) {
    let { ctx, octo } = cfg

    // Private repos rely on webhooks post-install; nothing to do
    if (savedRepo.private) {
        return
    }

    console.log('getting repo')

    let repoData = await octoCatch(octo.rest.repos.get({ owner: cfg.owner, repo: cfg.repo }))
    if (isErr(repoData)) {
        return err(`failed to get repo: ${repoData.error.error()}`)
    }
    let defaultBranch = repoData.default_branch
    if (defaultBranch) {
        await ctx.runMutation(api.protected.setRepoHead, {
            ...SECRET,
            repoId: savedRepo._id,
            headRefName: defaultBranch,
        })
    }

    console.log('getting all refs')

    let refs = await getAllRefs(octo, { owner: cfg.owner, repo: cfg.repo })
    if (isErr(refs)) {
        return wrap('failed to get refs', refs)
    }

    let desiredRefs = refs
    await ctx.runMutation(api.protected.upsertRefs, {
        ...SECRET,
        refs: desiredRefs.map((r) => ({ repoId: savedRepo._id, ...r })),
    })

    console.log('backfilling commits')

    let commitsRes = await backfillCommits({ ...cfg, ctx, repoId: savedRepo._id })
    if (isErr(commitsRes)) return wrap('failed to backfill commits', commitsRes)

    console.log('backfilled commits')

    console.log('backfilling issues')

    let issuesIter = octo.paginate.iterator(octo.rest.issues.listForRepo, {
        owner: cfg.owner,
        repo: cfg.repo,
        per_page: 100,
        state: 'all',
        since: syncState.issuesSince,
    })
    let lastIssueUpdated: string | undefined
    for await (let { data: issuesPage } of issuesIter) {
        for (let issue of issuesPage) {
            console.log('processing issue', issue.number)

            let labels: string[] = []
            for (let label of issue.labels ?? []) {
                if (typeof label === 'string') labels.push(label)
                else if (label.name) labels.push(label.name)
            }

            let issueState: 'open' | 'closed'
            if (issue.state === 'open' || issue.state === 'closed') issueState = issue.state
            else continue

            console.log('getting or creating issue', issue.number)

            let issueDoc = await ctx.runMutation(api.protected.getOrCreateIssue, {
                ...SECRET,
                repoId: savedRepo._id,
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
            console.log('issue upserted', issue.number)

            if (!issueDoc) continue

            let issueId = issueDoc._id
            if (!lastIssueUpdated || issue.updated_at > lastIssueUpdated) {
                lastIssueUpdated = issue.updated_at
            }

            if (issue.comments && issue.comments > 0) {
                console.log('processing comments for issue', issue.number)

                let commentsIter = octo.paginate.iterator(octo.rest.issues.listComments, {
                    owner: cfg.owner,
                    repo: cfg.repo,
                    issue_number: issue.number,
                    per_page: 100,
                    since: syncState.commentsSince,
                })
                let lastCommentUpdated: string | undefined
                for await (let { data: commentsPage } of commentsIter) {
                    for (let comment of commentsPage) {
                        await ctx.runMutation(api.protected.getOrCreateIssueComment, {
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
                if (lastCommentUpdated) {
                    await ctx.runMutation(api.protected.upsertSyncState, {
                        ...SECRET,
                        repoId: savedRepo._id,
                        commentsSince: lastCommentUpdated,
                    })
                }
            }
        }
    }
    if (lastIssueUpdated) {
        await ctx.runMutation(api.protected.upsertSyncState, {
            ...SECRET,
            repoId: savedRepo._id,
            issuesSince: lastIssueUpdated,
        })
    }
}

// Private backfill helpers (commits + issues) modeled on downloads.ts
type PrivateBackfillCfg = SyncRepoConfig & { repoId: Id<'repos'> }

async function validatePublicLicense(octo: Octokit, args: { owner: string; repo: string }) {
    let license = await octoCatch(octo.rest.licenses.getForRepo(args))
    if (isErr(license)) {
        if (license.error.status === 404) {
            return err('license not found')
        } else {
            return err(license.error.error())
        }
    }

    let spdxId = license.license?.spdx_id
    if (!spdxId) return err('license-not-found')
    if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
        return err(`license-not-supported:${spdxId}`)
    }

    return 'license-ok'
}

async function backfillCommits(cfg: PrivateBackfillCfg) {
    let { octo, owner, repo, ctx, repoId } = cfg

    let allCommits = octo.paginate.iterator(octo.rest.repos.listCommits, {
        owner,
        repo,
        per_page: 100,
    })

    let writtenTrees = new Map<string, Id<'trees'>>()
    let writtenTreeEntries = new Map<string, Id<'treeEntries'>>()
    let writtenCommits = new Map<string, Id<'commits'>>()

    for await (let { data: commitsPage } of allCommits) {
        for (let commit of commitsPage) {
            let isCommitWritten = await ctx.runMutation(api.protected.isCommitWritten, {
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
            if (isErr(treeData)) {
                return err(`failed to get tree: ${treeData.error.error()}`)
            }

            if (treeData.truncated) {
                return err('tree too big to process: truncated')
            }

            console.log('got tree data')

            let treeId = writtenTrees.get(rootTreeSha)
            if (!treeId) {
                let treeDoc = await ctx.runMutation(api.protected.getOrCreateTree, {
                    ...SECRET,
                    repoId,
                    sha: rootTreeSha,
                })
                if (treeDoc) writtenTrees.set(rootTreeSha, treeDoc._id)
            }

            let commitId = writtenCommits.get(commit.sha)
            if (!commitId) {
                let commitDoc = await ctx.runMutation(api.protected.getOrCreateCommit, {
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

            for (let treeEntry of treeData.tree) {
                console.log('processing tree entry', treeEntry.path)
                let existingTreeEntryId = writtenTreeEntries.get(treeEntry.sha)
                if (existingTreeEntryId) continue

                let processRes = await processTreeEntry(
                    { ctx, octo, owner, repo },
                    treeEntry,
                    rootTreeSha,
                    repoId,
                )
                if (isErr(processRes)) {
                    return wrap('failed to process tree entry', processRes)
                }
                if (processRes) writtenTreeEntries.set(treeEntry.sha, processRes._id)
            }
        }
    }

    return 'commits-complete'
}

async function backfillIssues(cfg: PrivateBackfillCfg) {
    let { octo, owner, repo, ctx, repoId } = cfg

    let issuesIterator = octo.paginate.iterator(octo.rest.issues.listForRepo, {
        owner,
        repo,
        per_page: 100,
        state: 'all',
    })

    let lastIssueUpdated: string | undefined
    let lastCommentUpdated: string | undefined

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

            let issueDoc = await ctx.runMutation(api.protected.getOrCreateIssue, {
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
                        await ctx.runMutation(api.protected.getOrCreateIssueComment, {
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
        }
    }

    console.log('upserting sync state')

    if (lastIssueUpdated) {
        await ctx.runMutation(api.protected.upsertSyncState, {
            ...SECRET,
            repoId,
            issuesSince: lastIssueUpdated,
        })
    }
    if (lastCommentUpdated) {
        await ctx.runMutation(api.protected.upsertSyncState, {
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
        if (isErr(blob)) {
            return err(`failed to get blob: ${blob.error.error()}`)
        }

        let blobContentBase64 = blob.content
        let blobSize = blob.size ?? 0

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

        newTreeEntry = await ctx.runMutation(api.protected.getOrCreateTreeEntry, {
            ...SECRET,
            entrySha: treeEntry.sha,
            entryType: 'blob' as const,
            mode: treeEntry.mode,
            path: treeEntry.path,
            rootTreeSha: rootTreeSha,
            repoId,
        })

        await ctx.runMutation(api.protected.upsertBlob, {
            ...SECRET,
            repoId,
            sha: treeEntry.sha,
            content: storedContent,
            encoding: storedEncoding,
            size: blobSize,
        })
    } else if (treeEntry.type === 'tree') {
        console.log('storing tree', treeEntry.path)

        newTreeEntry = await ctx.runMutation(api.protected.getOrCreateTreeEntry, {
            ...SECRET,
            repoId,
            rootTreeSha: rootTreeSha,
            entrySha: treeEntry.sha,
            entryType: 'tree' as const,
            mode: treeEntry.mode,
            path: treeEntry.path,
        })

        await ctx.runMutation(api.protected.getOrCreateTree, {
            ...SECRET,
            repoId,
            sha: treeEntry.sha,
        })
    }

    return newTreeEntry
}
