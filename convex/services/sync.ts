import { vWorkflowId, type WorkflowStep } from '@convex-dev/workflow'
import { vResultValidator } from '@convex-dev/workpool'
import { api, internal } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { internalMutation, type ActionCtx } from '@convex/_generated/server'
import { appEnv } from '@convex/env'
import {
    protectedAction,
    protectedMutation,
    runAction,
    runMutation,
    runQuery,
} from '@convex/localcx'
import { SaveWorkflowResult } from '@convex/models/repos'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { actionFn, logger } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { assert } from 'convex-helpers'
import { paginationOptsValidator, type FunctionArgs } from 'convex/server'
import { v } from 'convex/values'
import { Github, newOctokit } from './github'
import { buildIssuesWithCommentsBatch, fetchIssuesPageGraphQL } from './graphqlIssues'

// Listing data reference:
// https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-commits
// https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#list-matching-references
// https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28&search-overlay-input=heads#list-repository-issues

export const checkRepos = protectedMutation({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let repoPagination = await ctx.db.query('repos').paginate(args.paginationOpts)

        for (let repo of repoPagination.page) {
            let userRepos = await ctx.db
                .query('userRepos')
                .withIndex('by_repoId', (r) => r.eq('repoId', repo._id))
                .collect()
            let userIds = userRepos.map((r) => r.userId)

            // for a moreless fair distribution of token usage
            let randomUserId = userIds[Math.floor(Math.random() * userIds.length)]!

            await ctx.scheduler.runAfter(0, api.services.sync.incrementalSync, {
                secret: appEnv.SECRET,
                repoId: repo._id,
                userId: randomUserId,
            })
        }

        if (!repoPagination.isDone) {
            await ctx.runMutation(api.services.sync.checkRepos, {
                secret: appEnv.SECRET,
                paginationOpts: {
                    ...args.paginationOpts,
                    cursor: repoPagination.continueCursor,
                },
            })
        }
    },
})

/**
 * Check whether repo needs to sync data using a `since` date parameter.
 * Saves and uses etags to not waste user rate limits.
 */
export const IncrementalSync = actionFn({
    args: {
        repoId: v.id('repos'),
        userId: v.id('users'),
    },
    async handler(ctx, args) {
        let savedRepo = await runQuery(ctx, api.models.repos.get, { repoId: args.repoId })
        assert(savedRepo, 'repo not found')

        let octo
        octo = await octoFromUserId(ctx, args.userId)
        octo = unwrap(octo)

        let etags = await runQuery(ctx, api.models.pats.getEtagsForUser, {
            userId: args.userId,
            repoId: args.repoId,
        })

        let updates
        updates = await Github.checkForIssueUpdates(octo, {
            owner: savedRepo.owner,
            repo: savedRepo.repo,
            since: savedRepo.download.lastSyncedAt,
            etag: etags?.issuesEtag,
        })
        updates = unwrap(updates)

        if (updates.newEtag) {
            logger.debug(`${savedRepo.owner}/${savedRepo.repo}: new etag found`)

            await runMutation(ctx, api.models.pats.upsertEtagsForUser, {
                userId: args.userId,
                repoId: args.repoId,
                issuesEtag: updates.newEtag,
            })
        }

        if (!updates.hasUpdates) {
            logger.debug(`${savedRepo.owner}/${savedRepo.repo}: no updates found, skipping sync`)
            logger.info(`${savedRepo.owner}/${savedRepo.repo}: no updates found, skipping sync`)
            return
        }

        let slug = `${savedRepo.owner}/${savedRepo.repo}`
        let lastSyncedAt = savedRepo.download.lastSyncedAt
        logger.info(`${slug}: has updates, syncing issues since ${lastSyncedAt}`)

        let startSync = new Date().toISOString()

        let res = await DownloadRepoPage.handler(ctx, {
            userId: args.userId,
            repoId: args.repoId,
            fetchedPages: 0,
            lastSyncedAt: savedRepo.download.lastSyncedAt,
        })
        let workflowRes
        if (res.isErr) {
            workflowRes = { kind: 'failed' as const, error: res.err }
        } else {
            workflowRes = { kind: 'success' as const, returnValue: res.val }
        }

        logger.info(`${slug}: workflow result: ${workflowRes.kind}`)

        await runMutation(ctx, api.models.repos.saveWorkflowResult, {
            repoId: args.repoId,
            lastSyncedAt: startSync,
            workflowRes,
        })
    },
})

export const incrementalSync = protectedAction(IncrementalSync)

export const setIssueCounts = protectedMutation({
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

export const backfillRepoWorkflow = workflow.define({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(step, { repoId, userId }): Promise<void> {
        let fetchedPages = 0
        let cursor: string | undefined

        let savedRepo = await runQuery(step, api.models.repos.get, {
            repoId,
        })
        if (!savedRepo) throw new Error('repo not found')

        await updateDownloadStatus(step, repoId, 'backfilling')

        while (true) {
            let next
            next = await runAction(step, api.services.sync.downloadRepoPage, {
                userId,
                repoId,
                fetchedPages,
                after: cursor,
            })
            next = unwrap(next).nextCursor

            if (!next) break

            cursor = next
        }

        await runMutation(step, api.services.sync.setIssueCounts, {
            repoId,
            state: 'open',
        })
        await runMutation(step, api.services.sync.setIssueCounts, {
            repoId,
            state: 'closed',
        })
    },
})

export const startWorkflow = protectedMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let savedRepo = await ctx.db.get(args.repoId)
        if (!savedRepo) return err('repo not found')

        let startSync = new Date().toISOString()

        await workflow.start(
            ctx,
            internal.services.sync.backfillRepoWorkflow,
            { userId: args.userId, repoId: savedRepo._id },
            {
                onComplete: internal.services.sync.finishBackfill,
                context: {
                    repoId: savedRepo._id,
                    backfillStartedAt: startSync,
                } satisfies FinishBackfillArgs['context'],
            },
        )
    },
})

type FinishBackfillArgs = FunctionArgs<typeof internal.services.sync.finishBackfill>

export const finishBackfill = internalMutation({
    args: {
        workflowId: vWorkflowId,
        result: vResultValidator,
        context: v.object({
            repoId: v.id('repos'),
            backfillStartedAt: v.string(),
        }),
    },
    async handler(ctx, args) {
        await SaveWorkflowResult.handler(ctx, {
            lastSyncedAt: args.context.backfillStartedAt,
            repoId: args.context.repoId,
            workflowRes: args.result,
        })
    },
})

const TOTAL_ISSUES_PER_PAGE = 20
const TOTAL_FETCHES_PER_CALL = 10

const DownloadRepoPage = actionFn({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        fetchedPages: v.number(),
        after: v.optional(v.string()),
        lastSyncedAt: v.optional(v.string()),
    },
    async handler(ctx, args) {
        let octo = await octoFromUserId(ctx, args.userId)
        if (octo.isErr) return octo

        let savedRepo = await runQuery(ctx, api.models.repos.get, { repoId: args.repoId })
        if (!savedRepo) return err('repo not found')

        let { owner, repo } = savedRepo
        let cursor = args.after
        let start = args.fetchedPages

        let dbInsertsP = Promise.resolve()
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
                    await runMutation(ctx, api.models.models.insertIssuesWithCommentsBatch, {
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

export const downloadRepoPage = protectedAction(DownloadRepoPage)

async function octoFromUserId(ctx: ActionCtx, userId: Id<'users'>) {
    let userToken = await runQuery(ctx, api.models.pats.getByUserId, {
        userId,
    })
    if (!userToken) return err('user token not found')

    let octo = newOctokit(userToken.token)
    return ok(octo)
}

async function updateDownloadStatus(
    step: WorkflowStep,
    repoId: Id<'repos'>,
    status: Doc<'repos'>['download']['status'],
) {
    await runMutation(step, api.models.repos.updateDownloadStatus, {
        repoId,
        download: { status },
    })
}
