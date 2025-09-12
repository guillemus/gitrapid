import { vWorkflowId, type WorkflowStep } from '@convex-dev/workflow'
import { vResultValidator } from '@convex-dev/workpool'
import { internal } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { internalAction, internalMutation, type ActionCtx } from '@convex/_generated/server'
import { Repos } from '@convex/models/repos'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { logger } from '@convex/utils'
import { workflow } from '@convex/workflow'
import type { FunctionArgs } from 'convex/server'
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

export const backfillRepoWorkflow = workflow.define({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(step, { repoId, userId }): Promise<void> {
        let fetchedPages = 0
        let cursor: string | undefined

        let savedRepo = await step.runQuery(internal.models.repos.get, { repoId })
        if (!savedRepo) throw new Error('repo not found')

        await updateDownloadStatus(step, repoId, 'backfilling')

        while (true) {
            let next
            next = await step.runAction(internal.services.sync.downloadRepoPage, {
                userId,
                repoId,
                fetchedPages,
                after: cursor,
            })
            next = unwrap(next).nextCursor

            if (!next) break

            cursor = next
        }

        await step.runMutation(internal.services.sync.setIssueCounts, { repoId, state: 'open' })
        await step.runMutation(internal.services.sync.setIssueCounts, { repoId, state: 'closed' })
    },
})

export const startWorkflow = internalMutation({
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
        await Repos.finishDownload(ctx, {
            lastSyncedAt: args.context.backfillStartedAt,
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

async function updateDownloadStatus(
    ctx: WorkflowStep,
    repoId: Id<'repos'>,
    status: Doc<'repos'>['download']['status'],
) {
    await ctx.runMutation(internal.models.repos.updateDownloadStatus, {
        repoId,
        download: { status },
    })
}
