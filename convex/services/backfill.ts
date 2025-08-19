import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { SECRET, logger, octoCatch, protectedAction } from '@convex/utils'
import { v } from 'convex/values'
import { Octokit } from 'octokit'
import { newOctokit } from './github'
import { updateCommits, updateIssues, updateRefs, type UpdateConfig } from './repoDataUpdate'

export const run = protectedAction({
    args: {
        token: v.string(),
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        let octo = newOctokit(args.token)

        let res = await runRepoBackfill({ ctx, octo, ...args })
        unwrap(res)
    },
})

type BackfillCfg = {
    ctx: ActionCtx
    octo: Octokit
    userId: Id<'users'>
    owner: string
    repo: string
    private: boolean
}

type BackfillCfgWithRepo = BackfillCfg & UpdateConfig

function createBackfillCfg(initial: BackfillCfg, savedRepo: Doc<'repos'>): BackfillCfgWithRepo {
    let cfg = { ...initial, savedRepo }

    return {
        ...cfg,
        async onCommitWrite(totalCommits) {
            await updateDownload(cfg, 'pending', `${totalCommits} commits written`)
        },
        async onIssueWrite(totalIssues) {
            await updateDownload(cfg, 'pending', `${totalIssues} issues written`)
        },
    }
}

async function updateDownload(
    cfg: { ctx: ActionCtx; savedRepo: Doc<'repos'> },
    status: 'pending' | 'success' | 'error',
    message: string,
) {
    await cfg.ctx.runMutation(api.models.repoDownloads.upsert, {
        ...SECRET,
        repoId: cfg.savedRepo._id,
        status,
        message,
    })
}

async function setDownloadSince(cfg: BackfillCfgWithRepo, since: Date) {
    await cfg.ctx.runMutation(api.models.repoDownloads.updateSince, {
        ...SECRET,
        repoId: cfg.savedRepo._id,
        syncedSince: since.toISOString(),
    })
}

async function runRepoBackfill(_cfg: BackfillCfg): R {
    let { ctx, octo } = _cfg

    logger.info('running backfill')

    let since = new Date()

    let savedRepo = await ctx.runMutation(api.models.models.insertNewRepo, {
        ...SECRET,
        userId: _cfg.userId,
        owner: _cfg.owner,
        repo: _cfg.repo,
        private: _cfg.private,
    })
    if (!savedRepo) return err('failed to save repo')

    let cfg = createBackfillCfg(_cfg, savedRepo)

    const run = async (): R => {
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

        await updateDownload(cfg, 'pending', 'updating refs')

        await updateRefs(cfg, defaultBranch)

        logger.info('upserted refs')

        logger.info('backfilling commits')
        await updateDownload(cfg, 'pending', 'updating commits')

        let commitsRes = await updateCommits(cfg)
        if (commitsRes.isErr) {
            return wrap('failed to backfill commits', commitsRes)
        }

        await updateIssues(cfg)

        // Just to be sure we don't forget any piece of data, we get the since
        // "since" the start of the download.  We will use that date to later on
        // get the modified data since given date. Useful for incremental
        // syncing basically.
        await setDownloadSince(cfg, since)

        return ok()
    }

    await updateDownload(cfg, 'pending', 'starting download')

    let runResult = await run()
    if (runResult.isErr) {
        await updateDownload(cfg, 'error', `download error: ${runResult.err}`)
        return runResult
    }

    await updateDownload(cfg, 'success', '')

    return ok()
}
