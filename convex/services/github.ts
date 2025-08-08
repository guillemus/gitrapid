import { octoCatch, ok, wrap } from '@convex/utils'
import type { Octokit } from '@octokit/rest'

export type GitRefInfo = {
    name: string
    commitSha: string
    isTag: boolean
}

export async function getAllRefs(octo: Octokit, args: { owner: string; repo: string }) {
    let heads = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'heads' }))
    if (heads.error) return wrap('Failed to list heads refs', heads.error)

    let tags = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'tags' }))
    if (tags.error) return wrap('Failed to list tags refs', tags.error)

    let data: GitRefInfo[] = [
        ...heads.data.map((ref) => ({
            name: ref.ref.replace('refs/heads/', ''),
            commitSha: ref.object.sha,
            isTag: false,
        })),
        ...tags.data.map((ref) => ({
            name: ref.ref.replace('refs/tags/', ''),
            commitSha: ref.object.sha,
            isTag: true,
        })),
    ]

    return ok(data)
}
