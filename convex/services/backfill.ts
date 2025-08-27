// import { api } from '@convex/_generated/api'
// import type { Id } from '@convex/_generated/dataModel'
// import type { ActionCtx } from '@convex/_generated/server'
// import { err, ok, unwrap, wrap } from '@convex/shared'
// import { SECRET, logger, octoCatch, protectedAction } from '@convex/utils'
// import { v } from 'convex/values'
// import { Octokit } from 'octokit'
// import { newOctokit } from './github'
// import {
//     downloadCommits,
//     updateDownload,
//     downloadIssues,
//     downloadRefs,
//     type UpdateCfg,
// } from './downloadRepoData'

// export const run = protectedAction({
//     args: {
//         token: v.string(),
//         userId: v.id('users'),
//         owner: v.string(),
//         repo: v.string(),
//         isPrivate: v.boolean(),
//     },
//     async handler(ctx, args) {
//         let octo = newOctokit(args.token)

//         let res = await setupAndRunRepoBackfill({ ctx, octo, ...args })
//         unwrap(res)
//     },
// })

// // useful for debugging syncs
// export async function createSetupBackfillCfg(
//     ctx: ActionCtx,
//     userId: Id<'users'>,
//     owner: string,
//     repo: string,
//     isPrivate: boolean, // this is used to validate the license
// ) {
//     let pat = await ctx.runQuery(api.models.pats.getByUserId, { ...SECRET, userId })
//     if (!pat) throw new Error('pat not found')

//     let octo = newOctokit(pat.token)

//     let config: SetupBackfillCfg = { ctx, octo, owner, repo, isPrivate, userId }

//     return config
// }

// type SetupBackfillCfg = {
//     ctx: ActionCtx
//     octo: Octokit
//     userId: Id<'users'>
//     owner: string
//     repo: string
//     isPrivate: boolean
// }

// export async function setupAndRunRepoBackfill(cfg: SetupBackfillCfg): R {
//     let { ctx } = cfg

//     logger.info('running backfill')

//     let savedRepo = await ctx.runMutation(api.models.models.insertNewRepo, {
//         ...SECRET,
//         userId: cfg.userId,
//         owner: cfg.owner,
//         repo: cfg.repo,
//         private: cfg.isPrivate,
//     })
//     if (!savedRepo) return err('failed to save repo')

//     let backfillCfg: BackfillCfg = { ...cfg, savedRepo, isBackfill: true }

//     let res = await updateDownload(backfillCfg, 'backfilling', 'starting download')
//     if (res.isErr) return res

//     let since = new Date()

//     let runResult = await runRepoBackfill(backfillCfg)
//     if (runResult.isErr) {
//         res = await updateDownload(backfillCfg, 'error', `download error: ${runResult.err}`)
//         if (res.isErr) return res

//         return runResult
//     }

//     logger.info('backfill complete')
//     res = await updateDownload(backfillCfg, 'success', 'backfill complete')
//     if (res.isErr) return res

//     await setDownloadSince(backfillCfg, since)

//     return ok()
// }

// type BackfillCfg = SetupBackfillCfg & UpdateCfg

// async function runRepoBackfill(cfg: BackfillCfg) {
//     let { savedRepo, octo } = cfg

//     let owner = savedRepo.owner
//     let repo = savedRepo.repo

//     let repoData = await octoCatch(octo.rest.repos.get({ owner, repo }))
//     if (repoData.isErr) {
//         // on the first request to github we also check if the token is valid
//         // for the download

//         let isUnauthorized = repoData.err.status === 401
//         let badCredentials = repoData.err.error().includes('Bad credentials')
//         if (isUnauthorized && badCredentials) {
//             return err('bad credentials')
//         }

//         return err(`failed to get repo: ${repoData.err.error()}`)
//     }

//     logger.info('backfilling issues')

//     let res = await updateDownload(cfg, 'backfilling', 'updating issues')
//     if (res.isErr) return res

//     let issuesRes = await downloadIssues(cfg)
//     if (issuesRes.isErr) {
//         return wrap('failed to backfill issues', issuesRes)
//     }

//     return ok()
// }

// // TODO: eventually we will update commits again, but for the moment we need to
// // remove things from the scope of the project, otherwise I'm never ending this.
// async function _updateRepoCommits(cfg: BackfillCfg, defaultBranch: string) {
//     logger.info('updating refs')
//     let res = await updateDownload(cfg, 'backfilling', 'updating refs')
//     if (res.isErr) return res

//     let refsRes = await downloadRefs(cfg, defaultBranch)
//     if (refsRes.isErr) {
//         return wrap(`failed to backfill refs`, refsRes)
//     }

//     logger.info('upserted refs, backfilling commits')
//     res = await updateDownload(cfg, 'backfilling', 'updating commits')
//     if (res.isErr) return res

//     let commitsRes = await downloadCommits(cfg)
//     if (commitsRes.isErr) {
//         return wrap('failed to backfill commits', commitsRes)
//     }

//     logger.info('upserted commits')
// }

// async function setDownloadSince(cfg: BackfillCfg, since: Date) {
//     await cfg.ctx.runMutation(api.models.repoDownloads.updateSince, {
//         ...SECRET,
//         repoId: cfg.savedRepo._id,
//         syncedSince: since.toISOString(),
//     })
// }
