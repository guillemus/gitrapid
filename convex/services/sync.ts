import { vWorkflowId } from '@convex-dev/workflow'
import { vResultValidator } from '@convex-dev/workpool'
import { internal } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { internalAction, internalMutation, type ActionCtx } from '@convex/_generated/server'
import { SaveWorkflowResult } from '@convex/models/repos'
import { err, ok, unwrap } from '@convex/shared'
import { logger, type FnArgs } from '@convex/utils'
import { workflow } from '@convex/workflow'
import { assert } from 'convex-helpers'
import { paginationOptsValidator, type FunctionArgs } from 'convex/server'
import { v } from 'convex/values'
import { Github, newOctokit } from './github'
import { Graphql } from './graphql'

let fns = internal.services.sync

// Listing data reference:
// https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-commits
// https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#list-matching-references
// https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28&search-overlay-input=heads#list-repository-issues

function shouldBeSynced(repo: Doc<'repos'>) {
    switch (repo.download.status) {
        case 'initial':
            return false
        case 'backfilling':
            return false
        case 'syncing':
            return false
        case 'success':
            return true
        case 'error':
            return false
        case 'cancelled':
            return false
    }

    let _ = repo.download.status satisfies never
    return false
}

export const checkRepos = internalMutation({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let repoPagination = await ctx.db.query('repos').paginate(args.paginationOpts)

        for (let repo of repoPagination.page) {
            if (!shouldBeSynced(repo)) {
                continue
            }

            let userRepos = await ctx.db
                .query('userRepos')
                .withIndex('by_repoId', (r) => r.eq('repoId', repo._id))
                .collect()
            let userIds = userRepos.map((r) => r.userId)

            // for a moreless fair distribution of token usage
            let randomUserId = userIds[Math.floor(Math.random() * userIds.length)]!

            await ctx.scheduler.runAfter(0, fns.incrementalSync, {
                repoId: repo._id,
                userId: randomUserId,
            })
        }

        if (!repoPagination.isDone) {
            await ctx.runMutation(fns.checkRepos, {
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
export const IncrementalSync = {
    args: {
        repoId: v.id('repos'),
        userId: v.id('users'),
    },
    async handler(ctx: ActionCtx, args: FnArgs<typeof this.args>) {
        let savedRepo = await ctx.runQuery(internal.models.repos.get, { repoId: args.repoId })
        assert(savedRepo, 'repo not found')

        let octo
        octo = await octoFromUserId(ctx, args.userId)
        octo = unwrap(octo)

        let etags = await ctx.runQuery(internal.models.pats.getEtagsForUser, {
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

            await ctx.runMutation(internal.models.pats.upsertEtagsForUser, {
                userId: args.userId,
                repoId: args.repoId,
                issuesEtag: updates.newEtag,
            })
        }

        if (!updates.hasUpdates) {
            logger.debug(`${savedRepo.owner}/${savedRepo.repo}: no updates found, skipping sync`)
            return
        }

        let slug = `${savedRepo.owner}/${savedRepo.repo}`
        let lastSyncedAt = savedRepo.download.lastSyncedAt
        logger.info(`${slug}: has updates, syncing issues since ${lastSyncedAt}`)

        let startSync = new Date().toISOString()

        let res = await DownloadRepoPage.handler(ctx, {
            userId: args.userId,
            repoId: args.repoId,
            maxFetches: TOTAL_FETCHES_PER_CALL,
            lastSyncedAt: savedRepo.download.lastSyncedAt,
        })
        let workflowRes
        if (res.isErr) {
            workflowRes = { kind: 'failed' as const, error: res.err }
        } else {
            workflowRes = { kind: 'success' as const, returnValue: res.val }
        }

        logger.info(`${slug}: workflow result: ${workflowRes.kind}`)

        await ctx.runMutation(internal.models.repos.saveWorkflowResult, {
            repoId: args.repoId,
            lastSyncedAt: startSync,
            workflowRes,
        })
    },
}

export const incrementalSync = internalAction(IncrementalSync)

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

export const backfillRepoWorkflow = workflow.define({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(step, { repoId, userId }): Promise<void> {
        let cursor: string | undefined

        let savedRepo = await step.runQuery(internal.models.repos.get, {
            repoId,
        })
        assert(savedRepo, 'repo not found')

        await step.runMutation(internal.models.repos.updateDownloadStatus, {
            repoId,
            download: { status: 'backfilling' },
        })

        while (true) {
            let next

            next = await step.runAction(
                fns.downloadRepoPage,
                {
                    userId,
                    repoId,
                    maxFetches: TOTAL_FETCHES_PER_CALL,
                    after: cursor,
                },
                {
                    retry: {
                        initialBackoffMs: 4000,
                        base: 2,
                        maxAttempts: 5,
                    },
                },
            )
            next = unwrap(next)

            if (!next.nextCursor) break

            cursor = next.nextCursor
        }

        await step.runMutation(fns.setIssueCounts, { repoId, state: 'open' })
        await step.runMutation(fns.setIssueCounts, { repoId, state: 'closed' })
    },
})

export const startWorkflow = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let savedRepo = await ctx.db.get(args.repoId)
        assert(savedRepo, 'repo not found')

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
        let savedRepo = await ctx.db.get(args.context.repoId)
        assert(savedRepo, 'repo not found')

        let l = logger.child({ slug: `${savedRepo.owner}/${savedRepo.repo}` })
        if (args.result.kind === 'failed') {
            l.warn({ error: args.result.error }, 'backfill failed')
        } else if (args.result.kind === 'canceled') {
            l.warn('backfill canceled')
        } else if (args.result.kind === 'success') {
            l.info('backfill success')
        }

        await SaveWorkflowResult.handler(ctx, {
            lastSyncedAt: args.context.backfillStartedAt,
            repoId: args.context.repoId,
            workflowRes: args.result,
        })
    },
})

const TOTAL_FETCHES_PER_CALL = 10

const DownloadRepoPage = {
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        maxFetches: v.number(),
        after: v.optional(v.string()),
        lastSyncedAt: v.optional(v.string()),
    },
    async handler(ctx: ActionCtx, args: FnArgs<typeof this.args>): R<{ nextCursor?: string }> {
        let octo
        octo = await octoFromUserId(ctx, args.userId)
        if (octo.isErr) return octo
        octo = octo.val

        let savedRepo = await ctx.runQuery(internal.models.repos.get, { repoId: args.repoId })
        if (!savedRepo) return err('repo not found')

        let { owner, repo } = savedRepo
        let cursor = args.after

        let dbInsertsP = Promise.resolve()
        for (let i = 0; i < args.maxFetches; i++) {
            logger.info(`${owner}/${repo}: cursor ${cursor}`)

            let issuesPage = await Graphql.fetchIssuesPage(octo, {
                owner,
                repo,
                cursor,
                since: args.lastSyncedAt,
            })
            if (issuesPage.isErr) {
                if (issuesPage.err.type === 'RATE_LIMIT_ERROR') {
                    let secs = Math.max(issuesPage.err.err.retryAfterSecs, 10)
                    logger.warn({ secs }, 'rate limited; backing off')
                    await new Promise((resolve) => setTimeout(resolve, secs * 1000))
                    i--
                    continue
                }

                return err(issuesPage.err.err)
            }

            dbInsertsP = dbInsertsP.then(async () => {
                if (issuesPage.val.issues.length > 0) {
                    await ctx.runMutation(internal.models.models.insertIssuesWithCommentsBatch, {
                        repoId: savedRepo._id,
                        items: issuesPage.val.issues,
                    })
                }
            })

            let nextCursor = Graphql.getNextCursor(issuesPage.val.pageInfo)
            if (nextCursor.isNone) {
                cursor = undefined
                break
            }
            cursor = nextCursor.val.cursor

            // tiny jitter to avoid bursts
            let jitter = Math.floor(Math.random() * 200 + 1000)
            await new Promise((resolve) => setTimeout(resolve, jitter))
        }

        await dbInsertsP

        return ok({ nextCursor: cursor })
    },
}

export const downloadRepoPage = internalAction(DownloadRepoPage)

export async function octoFromUserId(ctx: ActionCtx, userId: Id<'users'>) {
    let userToken = await ctx.runQuery(internal.models.pats.getByUserId, {
        userId,
    })
    if (!userToken) return err('user token not found')

    let octo = newOctokit(userToken)
    return ok(octo)
}
