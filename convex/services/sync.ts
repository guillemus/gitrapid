import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { internalMutation, type ActionCtx } from '@convex/_generated/server'
import { Repos } from '@convex/models/repos'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { logger, protectedAction, SECRET } from '@convex/utils'
import { v, type Infer } from 'convex/values'
import { Octokit } from 'octokit'
import { downloadIssues, finishDownload, updateDownload, type UpdateCfg } from './downloadRepoData'
import { Github, newOctokit } from './github'

// Listing data reference:
// https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-commits
// https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#list-matching-references
// https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28&search-overlay-input=heads#list-repository-issues

export async function runHandler(ctx: ActionCtx) {
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
    let users = await ctx.runQuery(api.models.users.list, SECRET)
    let repoUserIds: Map<Id<'repos'>, Id<'users'>> = new Map()
    for (let user of users) {
        let repoIds = await ctx.runQuery(api.models.userRepos.listByUserId, {
            ...SECRET,
            userId: user._id,
        })

        for (let repoId of repoIds) {
            repoUserIds.set(repoId.repoId, user._id)
        }
    }

    for (let [repoId, userId] of repoUserIds.entries()) {
        await ctx.scheduler.runAfter(0, api.services.sync.runSingle, {
            ...SECRET,
            userId: userId,
            fetchRepoBy: {
                type: 'by-repo-id',
                repoId: repoId,
            },
            backfill: false,
        })
    }
}

export const run = protectedAction({ args: {}, handler: runHandler })

let runSingleArgs = v.object({
    fetchRepoBy: v.union(
        v.object({
            type: v.literal('by-owner-repo'),
            owner: v.string(),
            repo: v.string(),
        }),
        v.object({
            type: v.literal('by-repo-id'),
            repoId: v.id('repos'),
        }),
    ),

    userId: v.id('users'),
    backfill: v.boolean(),
})

export async function runSingleHandler(ctx: ActionCtx, args: Infer<typeof runSingleArgs>) {
    let userToken = await ctx.runQuery(api.models.pats.getByUserId, {
        ...SECRET,
        userId: args.userId,
    })
    if (!userToken) {
        throw new Error('user token not found')
    }

    let savedRepo
    if (args.fetchRepoBy.type === 'by-owner-repo') {
        savedRepo = await ctx.runQuery(api.models.repos.getByOwnerAndRepo, {
            ...SECRET,
            owner: args.fetchRepoBy.owner,
            repo: args.fetchRepoBy.repo,
        })
    } else if (args.fetchRepoBy.type === 'by-repo-id') {
        savedRepo = await ctx.runQuery(api.models.repos.get, {
            ...SECRET,
            repoId: args.fetchRepoBy.repoId,
        })
    }

    if (!savedRepo) {
        throw new Error('repo not found')
    }

    let repoId = savedRepo._id

    let octo = newOctokit(userToken.token)
    let res = await setupAndRunSync({
        ctx,
        octo,
        repoId,
        patId: userToken._id,
        userId: args.userId,
        backfill: args.backfill,
    })
    if (res.isErr) {
        throw new Error(
            `failed to sync repo ${savedRepo.owner}/${savedRepo.repo} for user ${args.userId}: ${res.err}`,
        )
    }
}

export const runSingle = protectedAction({ args: runSingleArgs, handler: runSingleHandler })

type SetupSyncCfg = {
    octo: Octokit
    ctx: ActionCtx
    userId: Id<'users'>
    repoId: Id<'repos'>
    patId: Id<'pats'>
    backfill: boolean
}

type SyncCfg = SetupSyncCfg & UpdateCfg

async function setupAndRunSync(cfg: SetupSyncCfg): R {
    let { ctx, repoId } = cfg

    let savedRepo = await ctx.runQuery(api.models.repos.get, { ...SECRET, repoId })
    if (!savedRepo) {
        return err('repo not found')
    }

    logger.info(`syncing repo ${savedRepo.owner}/${savedRepo.repo}`)

    let syncCfg: SyncCfg = {
        ...cfg,
        savedRepo,
        lastSyncedAt: savedRepo.download.lastSyncedAt,
        isBackfill: cfg.backfill,
    }

    let res = await updateDownload(syncCfg, 'syncing', 'syncing')
    if (res.isErr) return res

    let downloadStart = new Date()

    let syncRes = await runSync(syncCfg)
    if (syncRes.isErr) {
        res = await updateDownload(syncCfg, 'error', syncRes.err)
        if (res.isErr) return res

        return wrap('failed to sync repo', syncRes)
    }

    let updateRes = await updateTokenRateLimit(cfg)
    if (updateRes.isErr) {
        logger.error({ err: updateRes.err }, 'failed to update rate limit for token')
    }

    await finishDownload(syncCfg, downloadStart)

    return ok()
}

async function runSync(cfg: SyncCfg): R {
    let updateIssuesRes = await downloadIssues(cfg)
    if (updateIssuesRes.isErr) {
        return wrap('failed to sync issues', updateIssuesRes)
    }

    return ok()
}

async function updateTokenRateLimit(cfg: { octo: Octokit; ctx: ActionCtx; patId: Id<'pats'> }): R {
    let rateLimit = await Github.getRateLimit(cfg)
    if (rateLimit.isErr) {
        return wrap('failed to get rate limit', rateLimit)
    }

    await cfg.ctx.runMutation(api.models.pats.patch, {
        ...SECRET,
        id: cfg.patId,
        pat: { rateLimit: rateLimit.val },
    })
    return ok()
}

let setCurrentTokenRateLimitArgs = v.object({
    userId: v.id('users'),
})

export async function setCurrentTokenRateLimitHandler(
    ctx: ActionCtx,
    args: Infer<typeof setCurrentTokenRateLimitArgs>,
) {
    let userToken = await ctx.runQuery(api.models.pats.getByUserId, {
        ...SECRET,
        userId: args.userId,
    })
    if (!userToken) {
        throw new Error('user token not found')
    }

    let octo = newOctokit(userToken.token)
    let res = await updateTokenRateLimit({ ctx, octo, patId: userToken._id })
    unwrap(res)
}

export const setCurrentTokenRateLimit = protectedAction({
    args: setCurrentTokenRateLimitArgs,
    handler: setCurrentTokenRateLimitHandler,
})

export const setIssueCounts = internalMutation({
    args: {
        repo: v.string(),
        owner: v.string(),
    },
    async handler(ctx, args) {
        let repo = await Repos.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (!repo) {
            return err('repo not found')
        }

        let issues = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) => q.eq('repoId', repo._id))
            .collect()

        let openIssues = issues.filter((issue) => issue.state === 'open').length
        let closedIssues = issues.filter((issue) => issue.state === 'closed').length

        await ctx.db.patch(repo._id, {
            openIssues: openIssues,
            closedIssues: closedIssues,
        })
    },
})
