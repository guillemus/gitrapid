import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { ActionCtx } from '@convex/_generated/server'
import { addSecret, err } from '@convex/utils'
import type { Octokit } from '@octokit/rest'

type SyncPublicRepoConfig = {
    ctx: ActionCtx
    octo: Octokit
    owner: string
    repo: string
}

/**
 * Syncs a public repository to convex db.
 *
 * It syncs:
 *  - all git objects of a repo: commits, blobs, trees and refs
 *  - the current head of the repository
 *  - all issues and issue comments
 *  - (future) all prs
 */
export async function syncPublicRepo(cfg: SyncPublicRepoConfig) {
    let { ctx, octo } = cfg

    let savedRepo = await ctx.runQuery(
        api.protected.getRepo,
        addSecret({
            owner: cfg.owner,
            repo: cfg.repo,
        }),
    )
    if (!savedRepo) {
        return err('Repo not found')
    }

    // request to refs heads and compare the current head of the repository
    // if the head has changed, we need to sync commits

    // request to refs tags to check if new tags pushed
    // what happens if tag is removed? does it change the etag thingy?

    // request to issues with a since=issuesLastUpdated
}
