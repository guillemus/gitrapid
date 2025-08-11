import type { ActionCtx } from '@convex/_generated/server'
import { err, isErr, octoCatch } from '@convex/utils'
import { App } from '@octokit/app'
import type { Octokit } from '@octokit/rest'

export type GitRefInfo = {
    name: string
    commitSha: string
    isTag: boolean
}

export async function getAllRefs(octo: Octokit, args: { owner: string; repo: string }) {
    let heads = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'heads' }))
    if (isErr(heads)) return err(`Failed to list heads refs: ${heads.error.error()}`)

    let tags = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'tags' }))
    if (isErr(tags)) return err(`Failed to list tags refs: ${tags.error.error()}`)

    let data: GitRefInfo[] = [
        ...heads.map((ref) => ({
            name: ref.ref.replace('refs/heads/', ''),
            commitSha: ref.object.sha,
            isTag: false,
        })),
        ...tags.map((ref) => ({
            name: ref.ref.replace('refs/tags/', ''),
            commitSha: ref.object.sha,
            isTag: true,
        })),
    ]

    return data
}
