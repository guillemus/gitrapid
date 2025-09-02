import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import type { CommentForInsert, TimelineItemForInsert, UpsertDoc } from '@convex/models/models'
import { ok, wrap } from '@convex/shared'
import { SECRET, logger } from '@convex/utils'
import type { Octokit } from 'octokit'
import { fetchIssuesPageGraphQL, type IssueNode } from './graphqlIssues'

export type UpdateCfg = {
    ctx: ActionCtx
    octo: Octokit
    savedRepo: Doc<'repos'>
    lastSyncedAt?: string
    isBackfill: boolean
}

export async function downloadIssues(cfg: UpdateCfg): R {
    let { octo, savedRepo } = cfg
    let owner = savedRepo.owner
    let repo = savedRepo.repo

    logger.info('updating issues')

    let totalIssuesProcessed = 0
    let totalCommentsProcessed = 0
    let pagesProcessed = 0

    let after: string | undefined = undefined

    while (true) {
        let since: string | undefined = undefined
        if (!cfg.isBackfill) {
            since = cfg.lastSyncedAt
        }

        let pageRes = await fetchIssuesPageGraphQL(octo, { owner, repo, after, since })
        if (pageRes.isErr) return wrap('failed to fetch issues page', pageRes)

        let page = pageRes.val
        pagesProcessed++
        logger.debug(
            { after, count: page.nodes.length, hasNextPage: page.pageInfo.hasNextPage },
            'fetched issues page',
        )

        let items = buildIssuesWithCommentsBatch(savedRepo._id, page.nodes)

        let commentsInBatch = 0
        for (let it of items) commentsInBatch += it.comments.length
        logger.debug(
            { issues: items.length, comments: commentsInBatch },
            'built issues+comments batch',
        )

        if (items.length > 0) {
            logger.info({ issues: items.length }, 'writing issues+comments batch')
            await cfg.ctx.runMutation(api.models.models.insertIssuesWithCommentsBatch, {
                ...SECRET,
                items,
            })
            totalIssuesProcessed += items.length
            totalCommentsProcessed += commentsInBatch
            logger.debug('batch written')
        }

        if (cfg.isBackfill) {
            let res = await updateDownload(
                cfg,
                'backfilling',
                `Processed ${totalIssuesProcessed + items.length} issues, ${totalCommentsProcessed + commentsInBatch} comments`,
            )
            if (res.isErr) return res
        } else {
            let res = await updateDownload(
                cfg,
                'syncing',
                `Processed ${totalIssuesProcessed + items.length} issues, ${totalCommentsProcessed + commentsInBatch} comments`,
            )
            if (res.isErr) return res
        }

        if (!page.pageInfo.hasNextPage) break
        after = page.pageInfo.endCursor ?? undefined
    }

    logger.info({ pagesProcessed, totalIssuesProcessed, totalCommentsProcessed }, 'issues updated')

    return ok()
}

function buildIssuesWithCommentsBatch(repoId: Id<'repos'>, nodes: IssueNode[]) {
    let items: {
        issue: UpsertDoc<'issues'>
        body: string
        timelineItems: TimelineItemForInsert[]
        comments: CommentForInsert[]
    }[] = []

    for (let node of nodes) {
        items.push({
            issue: issueNodeToIssueDoc(node, repoId),
            body: node.body ?? '',
            timelineItems: issueNodeToTimelineItemsForInsert(node, repoId),
            comments: issueNodeToCommentsForInsert(node, repoId),
        })
    }

    return items
}

type UpdateDownloadCfg = {
    ctx: ActionCtx
    savedRepo: Doc<'repos'>
}

// This also handles checking whether the current download must be cancelled or
// not for simplicity.
export async function updateDownload(
    cfg: UpdateDownloadCfg,
    status: Doc<'repos'>['download']['status'],
    message: string,
) {
    let updated = await cfg.ctx.runMutation(api.models.repos.updateDownloadIfNotCancelled, {
        ...SECRET,
        repoId: cfg.savedRepo._id,
        download: { status, message, lastSyncedAt: cfg.savedRepo.download.lastSyncedAt },
    })
    if (updated.isErr) return wrap('failed to update download', updated)

    logger.debug(`DOWNLOAD PROGRESS UPDATE: ${message}`)

    return ok()
}

export async function finishDownload(
    cfg: { ctx: ActionCtx; savedRepo: Doc<'repos'> },
    lastSyncedAt: Date,
) {
    await cfg.ctx.runMutation(api.models.repos.updateDownloadIfNotCancelled, {
        ...SECRET,
        repoId: cfg.savedRepo._id,
        download: {
            status: 'success',
            message: 'finished download',
            lastSyncedAt: lastSyncedAt.toISOString(),
        },
    })
}

function issueNodeToIssueDoc(node: IssueNode, repoId: Id<'repos'>): UpsertDoc<'issues'> {
    let state: 'open' | 'closed' = node.state === 'CLOSED' ? 'closed' : 'open'
    let labels = node.labels.nodes.map((l) => l.name).filter((n): n is string => !!n)
    let assignees = node.assignees.nodes.map((a) => a.login).filter((n): n is string => !!n)
    let authorLogin = node.author?.login ?? ''
    let authorId = node.author?.databaseId ?? 0

    return {
        repoId,
        githubId: node.databaseId ?? 0,
        number: node.number,
        title: node.title,
        state,
        author: { login: authorLogin, id: authorId },
        labels: labels.length ? labels : undefined,
        assignees: assignees.length ? assignees : undefined,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        closedAt: node.closedAt ?? undefined,
        comments: node.comments.nodes.length || undefined,
    }
}

function issueNodeToCommentsForInsert(node: IssueNode, repoId: Id<'repos'>): CommentForInsert[] {
    let comments: CommentForInsert[] = []
    for (let c of node.comments.nodes) {
        comments.push({
            githubId: c.databaseId ?? 0,
            author: { login: c.author?.login ?? '', id: c.author?.databaseId ?? 0 },
            body: c.body ?? '',
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            repoId,
        })
    }

    return comments
}

function issueNodeToTimelineItemsForInsert(
    node: IssueNode,
    repoId: Id<'repos'>,
): TimelineItemForInsert[] {
    let timelineItems: TimelineItemForInsert[] = []
    for (let t of node.timelineItems?.nodes ?? []) {
        let item: TimelineItemForInsert['item']
        if (t.__typename === 'AssignedEvent') {
            item = {
                type: 'assigned',
                assignee: {
                    id: t.actor.databaseId ?? 0,
                    login: t.actor.login ?? '',
                },
            }
        } else if (t.__typename === 'UnassignedEvent') {
            item = {
                type: 'unassigned',
                assignee: {
                    id: t.actor.databaseId ?? 0,
                    login: t.actor.login ?? '',
                },
            }
        } else if (t.__typename === 'LabeledEvent') {
            item = {
                type: 'labeled',
                label: {
                    name: t.label.name ?? '',
                    color: t.label.color ?? '',
                },
            }
        } else if (t.__typename === 'UnlabeledEvent') {
            item = {
                type: 'unlabeled',
                label: {
                    name: t.label.name ?? '',
                    color: t.label.color ?? '',
                },
            }
        } else if (t.__typename === 'MilestonedEvent') {
            item = {
                type: 'milestoned',
                milestoneTitle: t.milestoneTitle ?? '',
            }
        } else if (t.__typename === 'DemilestonedEvent') {
            item = {
                type: 'demilestoned',
                milestoneTitle: t.milestoneTitle ?? '',
            }
        } else if (t.__typename === 'ClosedEvent') {
            item = {
                type: 'closed',
            }
        } else if (t.__typename === 'ReopenedEvent') {
            item = {
                type: 'reopened',
            }
        } else if (t.__typename === 'ReferencedEvent') {
            item = {
                type: 'referenced',
                commit: {
                    oid: t.commit.oid ?? '',
                    url: t.commit.url ?? '',
                },
            }
        } else if (t.__typename === 'CrossReferencedEvent') {
            item = {
                type: 'cross_referenced',
                source: {
                    type: t.source.__typename,
                    owner: t.source.repository.owner.login ?? '',
                    name: t.source.repository.name ?? '',
                    number: t.source.number ?? 0,
                },
            }
        } else if (t.__typename === 'LockedEvent') {
            item = {
                type: 'locked',
            }
        } else if (t.__typename === 'UnlockedEvent') {
            item = {
                type: 'unlocked',
            }
        } else if (t.__typename === 'PinnedEvent') {
            item = {
                type: 'pinned',
            }
        } else if (t.__typename === 'UnpinnedEvent') {
            item = {
                type: 'unpinned',
            }
        } else if (t.__typename === 'TransferredEvent') {
            item = {
                type: 'transferred',
                from: {
                    name: t.fromRepository.name ?? '',
                    owner: t.fromRepository.owner.login ?? '',
                },
                to: {
                    name: t.toRepository.name ?? '',
                    owner: t.toRepository.owner.login ?? '',
                },
            }
        } else {
            t satisfies never
            logger.error({ t }, 'unknown timeline item type')
            continue
        }

        timelineItems.push({
            repoId,
            githubNodeId: t.id,
            createdAt: t.createdAt,
            actor: {
                id: t.actor.databaseId ?? 0,
                login: t.actor.login ?? '',
            },
            item,
        })
    }
    return timelineItems
}
