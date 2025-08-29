import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import type { UpsertDoc } from '@convex/models/models'
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
        comments: {
            githubId: number
            author: { login: string; id: number }
            body: string
            createdAt: string
            updatedAt: string
        }[]
    }[] = []

    for (let node of nodes) {
        let state: 'open' | 'closed' = node.state === 'CLOSED' ? 'closed' : 'open'
        let labels = node.labels.nodes.map((l) => l.name).filter((n): n is string => !!n)
        let assignees = node.assignees.nodes.map((a) => a.login).filter((n): n is string => !!n)
        let authorLogin = node.author?.login ?? ''
        let authorId = node.author?.databaseId ?? 0

        let comments = node.comments.nodes.map((c) => ({
            githubId: c.databaseId ?? 0,
            author: { login: c.author?.login ?? '', id: c.author?.databaseId ?? 0 },
            body: c.body ?? '',
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }))

        items.push({
            issue: {
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
            },
            body: node.body ?? '',
            comments,
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
