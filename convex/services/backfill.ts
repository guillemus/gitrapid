import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { SECRET, logger, octoCatch, protectedAction } from '@convex/utils'
import { v } from 'convex/values'
import { Octokit } from 'octokit'
import { newOctokit } from './github'
import {
    updateCommits,
    updateDownload,
    updateIssues,
    updateRefs,
    type UpdateCfg,
} from './repoDataUpdate'

export const run = protectedAction({
    args: {
        token: v.string(),
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
        isPrivate: v.boolean(),
    },
    async handler(ctx, args) {
        let octo = newOctokit(args.token)

        let res = await setupAndRunRepoBackfill({ ctx, octo, ...args })
        unwrap(res)
    },
})

// useful for debugging syncs
export async function createSetupBackfillCfg(
    ctx: ActionCtx,
    userId: Id<'users'>,
    owner: string,
    repo: string,
    isPrivate: boolean, // this is used to validate the license
) {
    let pat = await ctx.runQuery(api.models.pats.getByUserId, { ...SECRET, userId })
    if (!pat) throw new Error('pat not found')

    let octo = newOctokit(pat.token)

    let config: SetupBackfillCfg = { ctx, octo, owner, repo, isPrivate, userId }

    return config
}

export async function setupAndRunRepoBackfill(cfg: SetupBackfillCfg): R {
    let { ctx } = cfg

    logger.info('running backfill')

    let savedRepo = await ctx.runMutation(api.models.models.insertNewRepo, {
        ...SECRET,
        userId: cfg.userId,
        owner: cfg.owner,
        repo: cfg.repo,
        private: cfg.isPrivate,
    })
    if (!savedRepo) return err('failed to save repo')

    let backfillCfg = createBackfillCfg(cfg, savedRepo)

    await updateDownload(backfillCfg, 'backfilling', 'starting download')

    let since = new Date()

    let runResult = await runRepoBackfill(backfillCfg)
    if (runResult.isErr) {
        await updateDownload(backfillCfg, 'error', `download error: ${runResult.err}`)
        return runResult
    }

    logger.info('backfill complete')
    await updateDownload(backfillCfg, 'success', 'backfill complete')

    await setDownloadSince(backfillCfg, since)

    return ok()
}

async function runRepoBackfill(cfg: BackfillCfg) {
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

    let defaultBranch = repoData.val.default_branch

    logger.info('updating refs')
    await updateDownload(cfg, 'backfilling', 'updating refs')

    let refsRes = await updateRefs(cfg, defaultBranch)
    if (refsRes.isErr) {
        return wrap(`failed to backfill refs`, refsRes)
    }

    logger.info('upserted refs, backfilling commits')
    await updateDownload(cfg, 'backfilling', 'updating commits')

    let commitsRes = await updateCommits(cfg)
    if (commitsRes.isErr) {
        return wrap('failed to backfill commits', commitsRes)
    }

    logger.info('upserted commits, backfilling issues')
    await updateDownload(cfg, 'backfilling', 'updating issues')

    let issuesRes = await updateIssues(cfg)
    if (issuesRes.isErr) {
        return wrap('failed to backfill issues', issuesRes)
    }

    return ok()
}

type SetupBackfillCfg = {
    ctx: ActionCtx
    octo: Octokit
    userId: Id<'users'>
    owner: string
    repo: string
    isPrivate: boolean
}

type BackfillCfg = SetupBackfillCfg & UpdateCfg

function createBackfillCfg(initial: SetupBackfillCfg, savedRepo: Doc<'repos'>): BackfillCfg {
    let cfg = { ...initial, savedRepo }

    return {
        ...cfg,
        async onCommitWrite(totalCommits) {
            logger.debug(`DOWNLOAD PROGRESS UPDATE: ${totalCommits} commits written`)
            await updateDownload(cfg, 'backfilling', `${totalCommits} commits written`)
        },
        async onIssueWrite(totalIssues) {
            logger.debug(`DOWNLOAD PROGRESS UPDATE: ${totalIssues} issues written`)
            await updateDownload(cfg, 'backfilling', `${totalIssues} issues written`)
        },
        async onTreeEntryWrite(path) {
            logger.debug(`DOWNLOAD PROGRESS UPDATE: added ${path}`)
            await updateDownload(cfg, 'backfilling', `added ${path}`)
        },
    }
}

async function setDownloadSince(cfg: BackfillCfg, since: Date) {
    await cfg.ctx.runMutation(api.models.repoDownloads.updateSince, {
        ...SECRET,
        repoId: cfg.savedRepo._id,
        syncedSince: since.toISOString(),
    })
}
