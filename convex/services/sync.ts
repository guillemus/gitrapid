import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { type ActionCtx } from '@convex/_generated/server'
import { canRepoBeSynced } from '@convex/models/repoDownloads'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { logger, octoCatch, protectedAction, SECRET } from '@convex/utils'
import { v, type Infer } from 'convex/values'
import { Octokit } from 'octokit'
import { getRateLimit, newOctokit } from './github'
import {
    updateCommits,
    updateDownload,
    updateIssues,
    updateRefs,
    type UpdateCfg,
} from './repoDataUpdate'
import { insertNewRepo } from '@convex/models/models'

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
        let userToken = await ctx.runQuery(api.models.pats.getByUserId, {
            ...SECRET,
            userId: userId,
        })
        if (!userToken) {
            logger.error(`user token for user id ${userId} not found`)
            continue
        }

        let octo = newOctokit(userToken.token)
        let res = await setupAndRunSync({
            ctx,
            octo,
            repoId,
            patId: userToken._id,
            userId: userId,
        })

        if (res.isErr) {
            logger.error(`failed to sync repo ${repoId} for user ${userId}: ${res.err}`)
        }
    }
}

export const run = protectedAction({ args: {}, handler: runHandler })

let runSingleArgs = v.object({
    userId: v.id('users'),
    owner: v.string(),
    repo: v.string(),
})

export async function runSingleHandler(ctx: ActionCtx, args: Infer<typeof runSingleArgs>) {
    let userToken = await ctx.runQuery(api.models.pats.getByUserId, {
        ...SECRET,
        userId: args.userId,
    })
    if (!userToken) {
        throw new Error('user token not found')
    }

    let repo = await ctx.runQuery(api.models.repos.getByOwnerAndRepo, {
        ...SECRET,
        owner: args.owner,
        repo: args.repo,
    })
    if (!repo) {
        throw new Error('repo not found')
    }

    let repoId = repo._id

    let octo = newOctokit(userToken.token)
    let res = await setupAndRunSync({
        ctx,
        octo,
        repoId,
        patId: userToken._id,
        userId: args.userId,
    })
    if (res.isErr) {
        throw new Error(`failed to sync repo ${args.repo} for user ${args.userId}: ${res.err}`)
    }
}

export const runSingle = protectedAction({ args: runSingleArgs, handler: runSingleHandler })

type SetupSyncCfg = {
    octo: Octokit
    ctx: ActionCtx
    userId: Id<'users'>
    repoId: Id<'repos'>
    patId: Id<'pats'>
}

type SyncCfg = SetupSyncCfg & UpdateCfg

async function setupAndRunSync(cfg: SetupSyncCfg): R {
    let { ctx, repoId } = cfg

    let savedRepo = await ctx.runQuery(api.models.repos.get, { ...SECRET, repoId })
    if (!savedRepo) {
        return err('repo not found')
    }

    logger.info(`syncing repo ${savedRepo.owner}/${savedRepo.repo}`)

    let repoDownload = await ctx.runQuery(api.models.repoDownloads.getByRepoId, {
        ...SECRET,
        repoId,
    })
    if (!repoDownload) {
        return err(
            `repo download not found for repo ${savedRepo.owner}/${savedRepo.repo}: ${repoId}`,
        )
    }

    let canBeSynced = canRepoBeSynced(repoDownload)
    if (!canBeSynced) {
        let status = repoDownload.status
        logger.info(`Another download is already in progress (${status}), skipping sync`)

        return ok()
    }

    let syncCfg: SyncCfg = {
        ...cfg,
        savedRepo,
        since: repoDownload.syncedSince,
        isBackfill: false,
    }

    let res = await updateDownload(syncCfg, 'syncing', 'syncing')
    if (res.isErr) return res

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

    res = await updateDownload(syncCfg, 'success', 'sync complete')
    if (res.isErr) return res

    return ok()
}

async function runSync(cfg: SyncCfg): R {
    let { savedRepo, octo } = cfg

    let owner = savedRepo.owner
    let repo = savedRepo.repo

    let repoData = await octoCatch(octo.rest.repos.get({ owner, repo }))
    if (repoData.isErr) {
        // on the first request to github we also check if the token is valid
        // for the download

        let isUnauthorized = repoData.err.status === 401
        let badCredentials = repoData.err.error().includes('Bad credentials')
        if (isUnauthorized && badCredentials) {
            return err('bad credentials')
        }
        return err(`failed to get repo: ${repoData.err.error()}`)
    }

    let updateIssuesRes = await updateIssues(cfg)
    if (updateIssuesRes.isErr) {
        return wrap('failed to sync issues', updateIssuesRes)
    }

    return ok()
}

// TODO: eventually we will update commits again, but for the moment we need to
// remove things from the scope of the project, otherwise I'm never ending this.
async function _updateRepoCommits(cfg: SyncCfg, defaultBranch: string) {
    let updateRefsRes = await updateRefs(cfg, defaultBranch)
    if (updateRefsRes.isErr) {
        return wrap('failed to sync refs', updateRefsRes)
    }

    let updateCommitsRes = await updateCommits(cfg)
    if (updateCommitsRes.isErr) {
        return wrap('failed to sync commits', updateCommitsRes)
    }
}

async function updateTokenRateLimit(cfg: { octo: Octokit; ctx: ActionCtx; patId: Id<'pats'> }): R {
    let rateLimit = await getRateLimit(cfg)
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

export const setCurrentTokenRateLimit = protectedAction({
    args: {
        userId: v.id('users'),
    },
    async handler(ctx, args) {
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
    },
})
