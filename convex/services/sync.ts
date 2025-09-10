import { vWorkflowId } from '@convex-dev/workflow'
import { vResultValidator } from '@convex-dev/workpool'
import { internal } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { internalAction, internalMutation, type ActionCtx } from '@convex/_generated/server'
import { Repos } from '@convex/models/repos'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { logger } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { v } from 'convex/values'
import { newOctokit } from './github'
import { buildIssuesWithCommentsBatch, fetchIssuesPageGraphQL } from './graphqlIssues'

// Listing data reference:
// https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-commits
// https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#list-matching-references
// https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28&search-overlay-input=heads#list-repository-issues

export const run = internalAction({
    args: {},
    async handler(ctx) {
        logger.info('running sync')

        // TODO: things missing
        // - better distribution of user token -> repo to download.
        // - parallelize syncs
        // - add a way to retry failed syncs
        // - probably each repo should have it's /events endpoint polled, so
        //   that we can be more selective on what to sync. The current way tries
        //   to sync everything, while we could be more selective

        // I know this is bad, but idk there's like convex limits on how many docs can be read per query so I don't wanna risk it.
        // Still this way sucks and there's probably a smarter way of doing this
        let users = await ctx.runQuery(internal.models.users.list)
        let repoUserIds: Map<Id<'repos'>, Id<'users'>> = new Map()
        for (let user of users) {
            let repoIds = await ctx.runQuery(internal.models.userRepos.listByUserId, {
                userId: user._id,
            })

            for (let repoId of repoIds) {
                repoUserIds.set(repoId.repoId, user._id)
            }
        }

        for (let [repoId, userId] of repoUserIds.entries()) {
            await ctx.runMutation(internal.services.sync.startWorkflow, {
                userId: userId,
                repoId: repoId,
                backfill: false,
            })
        }
    },
})

export const setIssueCounts = internalMutation({
    args: {
        repoId: v.id('repos'),
        state: v.union(v.literal('open'), v.literal('closed')),
    },
    async handler(ctx, args) {
        let issues = await ctx.db
            .query('issues')
            .withIndex('by_repo_state_comments', (q) =>
                q.eq('repoId', args.repoId).eq('state', args.state),
            )
            .collect()

        if (args.state === 'open') {
            await ctx.db.patch(args.repoId, {
                openIssues: issues.length,
            })
        } else {
            await ctx.db.patch(args.repoId, {
                closedIssues: issues.length,
            })
        }
    },
})

export const syncWorkflow = workflow.define({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        lastSyncedAt: v.optional(v.string()),
    },
    async handler(step, args): Promise<void> {
        let fetchedPages = 0
        let cursor: string | undefined

        while (true) {
            let next
            next = await step.runAction(internal.services.sync.downloadRepoPage, {
                userId: args.userId,
                repoId: args.repoId,
                fetchedPages,
                after: cursor,
                lastSyncedAt: args.lastSyncedAt,
            })
            next = unwrap(next).nextCursor

            if (!next) break

            cursor = next
        }
    },
})

export const startWorkflow = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        backfill: v.boolean(),
    },
    async handler(ctx, args) {
        let savedRepo = await ctx.db.get(args.repoId)
        if (!savedRepo) return err('repo not found')

        let startSync = new Date().toISOString()

        let lastSyncedAt = savedRepo.download.lastSyncedAt
        if (args.backfill) {
            lastSyncedAt = undefined
        }

        await workflow.start(
            ctx,
            internal.services.sync.syncWorkflow,
            {
                userId: args.userId,
                repoId: savedRepo._id,
                lastSyncedAt,
            },
            {
                onComplete: internal.services.sync.finishDownload,
                context: {
                    repoId: savedRepo._id,
                    downloadStartedAt: startSync,
                },
            },
        )
    },
})

export const finishDownload = internalMutation({
    args: {
        workflowId: vWorkflowId,
        result: vResultValidator,
        context: v.object({
            repoId: v.id('repos'),
            downloadStartedAt: v.string(),
        }),
    },
    async handler(ctx, args) {
        await Repos.finishDownload(ctx, {
            lastSyncedAt: args.context.downloadStartedAt,
            repoId: args.context.repoId,
            workflowRes: args.result,
        })
    },
})

const TOTAL_ISSUES_PER_PAGE = 20
const TOTAL_FETCHES_PER_CALL = 10

export const downloadRepoPage = internalAction({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        fetchedPages: v.number(),
        after: v.optional(v.string()),
        lastSyncedAt: v.optional(v.string()),
    },
    async handler(ctx, args): R<{ nextCursor?: string }> {
        let octo = await octoFromUserId(ctx, args.userId)
        if (octo.isErr) return octo

        let savedRepo = await ctx.runQuery(internal.models.repos.get, { repoId: args.repoId })
        if (!savedRepo) return err('repo not found')

        let { owner, repo } = savedRepo

        let updateRes
        if (args.lastSyncedAt) {
            updateRes = await updateDownload({ ctx, savedRepo }, 'syncing')
        } else {
            updateRes = await updateDownload({ ctx, savedRepo }, 'backfilling')
        }
        if (updateRes.isErr) return updateRes

        let cursor = args.after

        let dbInsertsP = Promise.resolve()

        let start = args.fetchedPages

        for (let i = start; i < start + TOTAL_FETCHES_PER_CALL; i++) {
            logger.info(`${owner}/${repo}: fetching ${TOTAL_ISSUES_PER_PAGE} issues page ${i}`)

            let page = await fetchIssuesPageGraphQL(octo.val, {
                owner,
                repo,
                first: TOTAL_ISSUES_PER_PAGE,
                after: cursor,
                since: args.lastSyncedAt,
            })
            if (page.isErr) return wrap('failed to fetch issues page', page)

            cursor = page.val.pageInfo.endCursor ?? undefined

            dbInsertsP = dbInsertsP.then(async () => {
                let items = buildIssuesWithCommentsBatch(savedRepo._id, page.val.nodes)

                if (items.length > 0) {
                    await ctx.runMutation(internal.models.models.insertIssuesWithCommentsBatch, {
                        items,
                    })
                }
            })

            if (!page.val.pageInfo.hasNextPage) break

            // help with backpressure a bit
            await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        await dbInsertsP

        return ok({ nextCursor: cursor })
    },
})

async function octoFromUserId(ctx: ActionCtx, userId: Id<'users'>) {
    let userToken = await ctx.runQuery(internal.models.pats.getByUserId, {
        userId,
    })
    if (!userToken) return err('user token not found')

    let octo = newOctokit(userToken.token)
    return ok(octo)
}

type UpdateDownloadCfg = {
    ctx: ActionCtx
    savedRepo: Doc<'repos'>
}

async function updateDownload(
    cfg: UpdateDownloadCfg,
    status: Doc<'repos'>['download']['status'],
    message?: string,
) {
    let updated = await cfg.ctx.runMutation(internal.models.repos.updateDownload, {
        repoId: cfg.savedRepo._id,
        download: { status, message, lastSyncedAt: cfg.savedRepo.download.lastSyncedAt },
    })
    if (updated.isErr) return wrap('failed to update download', updated)

    return ok()
}
