import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { ok, wrap } from '@convex/shared'
import { SECRET, logger } from '@convex/utils'
import type { Octokit } from 'octokit'
import { buildIssuesWithCommentsBatch, fetchIssuesPageGraphQL } from './graphqlIssues'

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

    let after: string | undefined
    let dbInsertsP = Promise.resolve<unknown>('')

    while (true) {
        let since: string | undefined
        if (!cfg.isBackfill) {
            since = cfg.lastSyncedAt
        }

        let pageRes = await fetchIssuesPageGraphQL(octo, { owner, repo, after, since })
        if (pageRes.isErr) return wrap('failed to fetch issues page', pageRes)

        let page = pageRes.val
        pagesProcessed++
        logger.debug(
            { after, count: page.nodes?.length, hasNextPage: page.pageInfo?.hasNextPage },
            'fetched issues page',
        )

        dbInsertsP = dbInsertsP.then(insertData)
        async function insertData() {
            let items = buildIssuesWithCommentsBatch(savedRepo._id, page.nodes)

            let commentsInBatch = 0
            for (let it of items) commentsInBatch += it.comments.length
            logger.debug(
                { issues: items.length, comments: commentsInBatch },
                'built issues+comments batch',
            )

            if (items.length > 0) {
                logger.info({ issues: items.length }, 'writing issues+comments batch')

                console.time('inserting issues')
                await cfg.ctx.runMutation(api.models.models.insertIssuesWithCommentsBatch, {
                    ...SECRET,
                    items,
                })
                console.timeEnd('inserting issues')

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
        }

        if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break

        after = page.pageInfo.endCursor

        // wait a bit to not overload the gql api
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    await dbInsertsP

    logger.info({ pagesProcessed, totalIssuesProcessed, totalCommentsProcessed }, 'issues updated')

    return ok()
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
