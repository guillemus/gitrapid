import { octoCatch, OctoError, parseDate } from '@convex/utils'
import { Octokit } from 'octokit'
import { err, ok, tryCatch, wrap } from '../shared'

export type GitRefInfo = {
    name: string
    commitSha: string
    isTag: boolean
}

export async function getAllRefs(octo: Octokit, args: { owner: string; repo: string }) {
    let heads = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'heads' }))
    if (heads.isErr) return err(`Failed to list heads refs: ${heads.err.error()}`)

    let tags = await octoCatch(octo.rest.git.listMatchingRefs({ ...args, ref: 'tags' }))
    if (tags.isErr) return err(`Failed to list tags refs: ${tags.err.error()}`)

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

export type LicenseError =
    | { type: 'license-not-found' }
    | { type: 'license-not-supported'; spdxId: string }
    | { type: 'octo-error'; err: OctoError }

export async function validatePublicLicense(
    octo: Octokit,
    args: { owner: string; repo: string },
): R<null, LicenseError> {
    let license = await octoCatch(octo.rest.licenses.getForRepo(args))
    if (license.isErr) {
        if (license.err.status === 404) {
            return err({ type: 'license-not-found' })
        } else {
            return err({ type: 'octo-error', err: license.err })
        }
    }

    let spdxId = license.val.license?.spdx_id
    if (!spdxId) return err({ type: 'license-not-found' })
    if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
        return err({ type: 'license-not-supported', spdxId })
    }

    return ok()
}
