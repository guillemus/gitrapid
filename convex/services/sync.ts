import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import {
    addSecret,
    err,
    octoCatch,
    ok,
    runProtectedMutation,
    runProtectedQuery,
} from '@convex/utils'
import { Octokit } from '@octokit/rest'
import { Buffer } from 'buffer'
import { getAllRefs } from './github'
import type { FunctionReference, OptionalRestArgs } from 'convex/server'

type SyncRepoConfig = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
}

export async function syncRepo(cfg: SyncRepoConfig) {
    let { ctx, owner, repo } = cfg

    let savedRepo = await ctx.runQuery(
        api.protected.getRepo,
        addSecret({ owner: cfg.owner, repo: cfg.repo }),
    )
    if (!savedRepo) {
        return err('repo not found')
    }

    let syncState = await ctx.runMutation(
        api.protected.getOrCreateSyncState,
        addSecret({ repoId: savedRepo._id }),
    )
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

    if (result.isErr) {
        await ctx.runMutation(
            api.protected.upsertSyncState,
            addSecret({ repoId: savedRepo._id, syncError: result.error }),
        )
        return err(`syncRepo failed: ${result.error}`)
    }

    await ctx.runMutation(
        api.protected.upsertSyncState,
        addSecret({
            repoId: savedRepo._id,
            syncError: undefined,
            lastSuccessAt: new Date().toISOString(),
        }),
    )

    let durationMs = Date.now() - startedAt
    console.log(`${owner}/${repo}: sync success in ${durationMs}ms`)

    return ok('synced')
}

type CreateOctokitClientCfg = {
    ctx: ActionCtx
    userId: Id<'users'>
    owner: string
    repo: string
}

export async function createOctokitClient(cfg: CreateOctokitClientCfg) {
    // repo must exist; we need its privacy and id
    let repoDoc = await cfg.ctx.runQuery(
        api.protected.getRepo,
        addSecret({ owner: cfg.owner, repo: cfg.repo }),
    )
    if (!repoDoc) return err('repo not found')

    if (repoDoc.private) {
        // Use installation token for this user + repo
        let tokenDoc = await cfg.ctx.runQuery(
            api.protected.getInstallationTokenForUserRepo,
            addSecret({ userId: cfg.userId, repoId: repoDoc._id }),
        )
        if (!tokenDoc) return err('installation-token-not-found')

        let octo = new Octokit({ auth: tokenDoc.token })
        console.log(`${cfg.owner}/${cfg.repo}: Using token type: installation`)
        return ok(octo)
    }

    // Public: use user PAT
    let patDoc = await cfg.ctx.runQuery(api.protected.getPat, addSecret({ userId: cfg.userId }))
    if (!patDoc) return err('pat not found')

    let octo = new Octokit({ auth: patDoc.token })
    console.log(`${cfg.owner}/${cfg.repo}: Using token type: PAT`)

    return ok(octo)
}

async function runInitialBackfill(cfg: SyncRepoConfig, savedRepo: Doc<'repos'>) {
    let { ctx, octo, owner, repo } = cfg

    let repoRes = await octoCatch(octo.repos.get({ owner, repo }))
    if (repoRes.isErr) {
        let isUnauthorized = repoRes.error.status === 401
        let badCredentials = repoRes.error.error().includes('Bad credentials')
        if (isUnauthorized && badCredentials) {
            return err('bad credentials')
        }
        return err(`failed to get repo: ${repoRes.error.error()}`)
    }

    let refs = await getAllRefs(octo, { owner, repo })
    if (refs.isErr) {
        return err(`failed to get refs: ${refs.error}`)
    }

    let desiredRefs = refs.data
    await ctx.runMutation(
        api.protected.upsertRefs,
        addSecret({ refs: desiredRefs.map((r) => ({ repoId: savedRepo._id, ...r })) }),
    )

    await ctx.runMutation(
        api.protected.setRepoHead,
        addSecret({ repoId: savedRepo._id, headRefName: repoRes.data.default_branch }),
    )

    console.log('upserted refs')

    if (!savedRepo.private) {
        console.log('validating license')
        let licenseRes = await validatePublicLicense(octo, { owner, repo })
        if (licenseRes.isErr) return err(`license validation failed: ${licenseRes.error}`)

        console.log('license validated')
    }

    console.log('backfilling commits')
    let commitsRes = await backfillCommits({ ...cfg, ctx, repoId: savedRepo._id })
    if (commitsRes.isErr) return err(`failed to backfill commits: ${commitsRes.error}`)

    console.log('backfilled commits')

    console.log('backfilling issues')
    await backfillIssues({ ...cfg, ctx, repoId: savedRepo._id })
    console.log('backfilled issues')

    // Seed since-cursors from the latest observed timestamps
    // We do this during backfill issues pass already, but ensure state here too.
    await ctx.runMutation(
        api.protected.upsertSyncState,
        addSecret({ repoId: savedRepo._id, backfillDone: true }),
    )

    return ok('backfill-complete')
}

async function runIncrementalSync(
    cfg: SyncRepoConfig,
    savedRepo: Doc<'repos'>,
    syncState: Doc<'syncStates'>,
) {
    let { ctx, octo } = cfg

    // Private repos rely on webhooks post-install; nothing to do
    if (savedRepo.private) {
        return ok('private-repo: incremental sync skipped')
    }

    console.log('getting repo')

    let repoRes = await octoCatch(octo.repos.get({ owner: cfg.owner, repo: cfg.repo }))
    if (repoRes.isErr) {
        return err(`failed to get repo: ${repoRes.error.error()}`)
    }
    let defaultBranch = repoRes.data.default_branch
    if (defaultBranch) {
        await ctx.runMutation(
            api.protected.setRepoHead,
            addSecret({ repoId: savedRepo._id, headRefName: defaultBranch }),
        )
    }

    console.log('getting all refs')

    let refs = await getAllRefs(octo, { owner: cfg.owner, repo: cfg.repo })
    if (refs.isErr) {
        return err(`failed to get refs: ${refs.error}`)
    }
    let desiredRefs = refs.data
    await ctx.runMutation(
        api.protected.upsertRefs,
        addSecret({ refs: desiredRefs.map((r) => ({ repoId: savedRepo._id, ...r })) }),
    )

    console.log('backfilling commits')

    let commitsRes = await backfillCommits({ ...cfg, ctx, repoId: savedRepo._id })
    if (commitsRes.isErr) return err(`failed to backfill commits: ${commitsRes.error}`)

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

            let issueDoc = await ctx.runMutation(
                api.protected.getOrCreateIssue,
                addSecret({
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
                }),
            )
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
                        await ctx.runMutation(
                            api.protected.getOrCreateIssueComment,
                            addSecret({
                                issueId,
                                githubId: comment.id,
                                author: {
                                    login: comment.user?.login ?? '',
                                    id: comment.user?.id ?? 0,
                                },
                                body: comment.body ?? '',
                                createdAt: comment.created_at,
                                updatedAt: comment.updated_at,
                            }),
                        )
                        if (!lastCommentUpdated || comment.updated_at > lastCommentUpdated) {
                            lastCommentUpdated = comment.updated_at
                        }
                    }
                }
                if (lastCommentUpdated) {
                    await ctx.runMutation(
                        api.protected.upsertSyncState,
                        addSecret({ repoId: savedRepo._id, commentsSince: lastCommentUpdated }),
                    )
                }
            }
        }
    }
    if (lastIssueUpdated) {
        await ctx.runMutation(
            api.protected.upsertSyncState,
            addSecret({ repoId: savedRepo._id, issuesSince: lastIssueUpdated }),
        )
    }

    return ok('incremental-complete')
}

// Private backfill helpers (commits + issues) modeled on downloads.ts
type PrivateBackfillCfg = SyncRepoConfig & { repoId: Id<'repos'> }

async function validatePublicLicense(octo: Octokit, args: { owner: string; repo: string }) {
    let license = await octoCatch(octo.rest.licenses.getForRepo(args))
    if (license.isErr) {
        if (license.error.status === 404) {
            return err('license-not-found')
        }
        return err(license.error.error())
    }

    let spdxId = license.data.license?.spdx_id
    if (!spdxId) return err('license-not-found')
    if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
        return err(`license-not-supported:${spdxId}`)
    }
    return ok('license-ok')
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
            let isCommitWritten = await ctx.runMutation(
                api.protected.isCommitWritten,
                addSecret({ repoId, sha: commit.sha }),
            )
            if (isCommitWritten) {
                console.log('commit already written', commit.sha)
                continue
            }

            console.log(`processing commit ${commit.sha}`)

            let rootTreeSha = commit.commit.tree.sha

            let githubTree
            githubTree = octo.git.getTree({
                owner,
                repo,
                tree_sha: rootTreeSha,
                recursive: 'true',
            })
            githubTree = await octoCatch(githubTree)
            if (githubTree.isErr) {
                return err(`failed to get tree: ${githubTree.error.error()}`)
            }

            let treeData = githubTree.data
            if (treeData.truncated) {
                return err('tree too big to process: truncated')
            }

            console.log('got tree data')

            let treeId = writtenTrees.get(rootTreeSha)
            if (!treeId) {
                let treeDoc = await ctx.runMutation(
                    api.protected.getOrCreateTree,
                    addSecret({ repoId, sha: rootTreeSha }),
                )
                if (treeDoc) writtenTrees.set(rootTreeSha, treeDoc._id)
            }

            let commitId = writtenCommits.get(commit.sha)
            if (!commitId) {
                let commitDoc = await ctx.runMutation(
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
                if (processRes.isErr) return err(processRes.error)
                if (processRes.data) writtenTreeEntries.set(treeEntry.sha, processRes.data._id)
            }
        }
    }

    return ok('commits-complete')
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

            let issueDoc = await ctx.runMutation(
                api.protected.getOrCreateIssue,
                addSecret({
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
                }),
            )
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
                        await ctx.runMutation(
                            api.protected.getOrCreateIssueComment,
                            addSecret({
                                issueId,
                                githubId: comment.id,
                                author: {
                                    login: comment.user?.login ?? '',
                                    id: comment.user?.id ?? 0,
                                },
                                body: comment.body ?? '',
                                createdAt: comment.created_at,
                                updatedAt: comment.updated_at,
                            }),
                        )
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
        await ctx.runMutation(
            api.protected.upsertSyncState,
            addSecret({ repoId, issuesSince: lastIssueUpdated }),
        )
    }
    if (lastCommentUpdated) {
        await ctx.runMutation(
            api.protected.upsertSyncState,
            addSecret({ repoId, commentsSince: lastCommentUpdated }),
        )
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

        let blob = octo.git.getBlob({ owner, repo, file_sha: treeEntry.sha })
        let blobRes = await octoCatch(blob)
        if (blobRes.isErr) {
            return err(`failed to get blob: ${blobRes.error.error()}`)
        }

        let blobData = blobRes.data
        let blobContentBase64 = blobData.content
        let blobSize = blobData.size ?? 0

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
        console.log('storing tree', treeEntry.path)

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
            addSecret({ repoId, sha: treeEntry.sha }),
        )
    }

    return ok(newTreeEntry)
}
