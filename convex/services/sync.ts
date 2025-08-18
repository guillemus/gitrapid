import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { err, ok, unwrap, wrap } from '@convex/shared'
import { octoCatch, protectedAction, SECRET } from '@convex/utils'
import { v } from 'convex/values'
import { Octokit } from 'octokit'
import { newOctokit } from './github'
import { updateCommits, updateIssues, updateRefs, type UpdateConfig } from './repoDataUpdate'

export const run = protectedAction({
    args: {
        token: v.string(),
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let octo = newOctokit(args.token)
        let res = await runSync({ ctx, octo, repoId: args.repoId })
        unwrap(res)
    },
})

type SyncCfg = {
    octo: Octokit
    ctx: ActionCtx
    repoId: Id<'repos'>
}

type SyncCfgWithRepo = SyncCfg & UpdateConfig

// https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-commits
// https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#list-matching-references
// https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28&search-overlay-input=heads#list-repository-issues

async function runSync(_cfg: SyncCfg): R {
    let { ctx, repoId, octo } = _cfg

    let savedRepo = await ctx.runQuery(api.models.repos.get, { ...SECRET, repoId })
    if (!savedRepo) return err('repo not found') // this should never happen

    let repoDownload = await ctx.runQuery(api.models.repoDownloads.getByRepoId, {
        ...SECRET,
        repoId,
    })
    if (!repoDownload) return err('repo status not found') // this should never happen

    if (!repoDownload.syncedSince) {
        // if the repo download exists but there's no since timestamp that means that the download is happening.
        // We can skip the sync and not worry about it, but this should not happen.
        return err('no since timestamps found')
    }

    let cfg: SyncCfgWithRepo = {
        ..._cfg,
        savedRepo,
        since: repoDownload.syncedSince,
        onCommitWrite: async () => {},
        onIssueWrite: async () => {},
    }

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

    let updateRefsRes = await updateRefs(cfg, defaultBranch)
    if (updateRefsRes.isErr) {
        return wrap('failed to sync refs', updateRefsRes)
    }

    let updateCommitsRes = await updateCommits(cfg)
    if (updateCommitsRes.isErr) {
        return wrap('failed to sync commits', updateCommitsRes)
    }

    await updateIssues(cfg)

    return ok()
}
