import { octoCatch, parseDate } from '@convex/utils'
import { Octokit } from 'octokit'
import { err, ok, tryCatch, wrap } from '../shared'

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

export async function getTokenExpiration(token: string): R<Date> {
    const octo = new Octokit({ auth: token })

    let res = await tryCatch(octo.rest.users.getAuthenticated())
    if (res.isErr) return wrap('failed to get token expiration', res)

    let expiration = res.val.headers['github-authentication-token-expiration']
    if (!expiration) {
        return err('no expiration header found in response')
    }

    if (typeof expiration === 'string') {
        return parseDate(expiration)
    } else if (typeof expiration === 'number') {
        return ok(new Date(expiration))
    }

    return err('invalid expiration header')
}
