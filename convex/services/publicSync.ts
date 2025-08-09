import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { addSecret, err, octoCatch, ok } from '@convex/utils'
import type { Octokit } from '@octokit/rest'
import { getAllRefs } from './github'

type SyncPublicRepoConfig = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
}

/**
 * Syncs a public repository to convex db.
 *
 * It syncs:
 *  - all git objects of a repo: commits, blobs, trees and refs
 *  - the current head of the repository
 *  - all issues and issue comments
 *  - (future) all prs
 */
export async function syncPublicRepo(cfg: SyncPublicRepoConfig) {
    let { ctx } = cfg

    let savedRepo = await ctx.runQuery(
        api.protected.getRepo,
        addSecret({
            owner: cfg.owner,
            repo: cfg.repo,
        }),
    )
    if (!savedRepo) return err('repo not found')

    // Ensure sync state exists (returns the document)
    let syncState = await ctx.runMutation(
        api.protected.getOrCreateSyncState,
        addSecret({ repoId: savedRepo._id }),
    )
    if (!syncState) return err('failed to get sync state')

    let result = await trySyncPublicRepo(cfg, savedRepo._id, syncState)

    if (result.isErr) {
        await ctx.runMutation(
            api.protected.upsertSyncState,
            addSecret({
                repoId: savedRepo._id,
                syncError: result.error,
            }),
        )
        return err(`failed to upsert sync state: ${result.error}`)
    }

    await ctx.runMutation(
        api.protected.upsertSyncState,
        addSecret({ repoId: savedRepo._id, syncError: undefined }),
    )

    return ok('synced')
}

async function trySyncPublicRepo(
    cfg: SyncPublicRepoConfig,
    repoId: Id<'repos'>,
    syncState: Doc<'syncStates'>,
) {
    let { ctx, octo } = cfg

    // Phase 1: Repo metadata and head
    let repoRes = await octoCatch(octo.repos.get({ owner: cfg.owner, repo: cfg.repo }))
    if (repoRes.isErr) {
        return err(`failed to get repo: ${repoRes.error.error()}`)
    }
    let defaultBranch = repoRes.data.default_branch
    if (defaultBranch) {
        await ctx.runMutation(
            api.protected.setRepoHead,
            addSecret({ repoId, headRefName: defaultBranch }),
        )
    }

    // Phase 2: Refs (branches + tags)
    let refs = await getAllRefs(octo, { owner: cfg.owner, repo: cfg.repo })
    if (refs.isErr) {
        return err(`failed to get refs: ${refs.error}`)
    }

    let desiredRefs = refs.data
    await ctx.runMutation(
        api.protected.upsertRefs,
        addSecret({ refs: desiredRefs.map((r) => ({ repoId, ...r })) }),
    )
    // Cleanup stale refs

    // Phase 3: Commits/Trees/Blobs backfill is expensive; rely on initial download for now

    // Phase 4/5: Issues and comments since-based
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
            let labels: string[] = []
            for (let label of issue.labels ?? []) {
                if (typeof label === 'string') labels.push(label)
                else if (label.name) labels.push(label.name)
            }

            let issueState: 'open' | 'closed'
            if (issue.state === 'open' || issue.state === 'closed') issueState = issue.state
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
                        addSecret({ repoId, commentsSince: lastCommentUpdated }),
                    )
                }
            }
        }
    }
    if (lastIssueUpdated) {
        await ctx.runMutation(
            api.protected.upsertSyncState,
            addSecret({ repoId, issuesSince: lastIssueUpdated }),
        )
    }

    return ok('synced')
}
