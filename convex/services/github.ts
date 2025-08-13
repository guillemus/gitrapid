import { api } from '@convex/_generated/api'
import type { ActionCtx } from '@convex/_generated/server'
import { err, logger, octoCatch, ok, SECRET } from '@convex/utils'
import { Octokit } from 'octokit'

export type GitRefInfo = {
    name: string
    commitSha: string
    isTag: boolean
}

export async function getAllRefs(octo: Octokit, args: { owner: string; repo: string }) {
    let heads = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'heads' }))
    if (heads.isErr) return err(`Failed to list heads refs: ${heads.error.error()}`)

    let tags = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'tags' }))
    if (tags.isErr) return err(`Failed to list tags refs: ${tags.error.error()}`)

    let data: GitRefInfo[] = [
        ...heads.val.map((ref) => ({
            name: ref.ref.replace('refs/heads/', ''),
            commitSha: ref.object.sha,
            isTag: false,
        })),
        ...tags.val.map((ref) => ({
            name: ref.ref.replace('refs/tags/', ''),
            commitSha: ref.object.sha,
            isTag: true,
        })),
    ]

    return ok(data)
}

// Meant for debugging
export async function logAllInstallations(ctx: ActionCtx) {
    let jwt = await ctx.runAction(api.nodeActions.createGithubAppToken, SECRET)
    logger.debug({ jwt }, 'Created GitHub App token')

    let octo = new Octokit({ auth: jwt })

    let allInstallations = octo.paginate.iterator(octo.rest.apps.listInstallations)
    for await (let installations of allInstallations) {
        logger.debug({ installations }, 'Installations page')
    }
}
