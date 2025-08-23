import { octoCatch, octoCatchFull, octoWrap, parseDate } from '@convex/utils'
import { Octokit } from 'octokit'
import { err, ok, tryCatch, wrap, type Result } from '../shared'

/**
 * Octokit for some reason accepts auth as any. This is bad, and I've been
 * bitten by this many times, so use this wrapper whenever creating newOctokits.
 */
export function newOctokit(token: string) {
    return new Octokit({ auth: token })
}

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
    const octo = newOctokit(token)

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
    | { type: 'octo-error'; err: string }

export async function validatePublicLicense(
    octo: Octokit,
    args: { owner: string; repo: string },
): R<null, LicenseError> {
    let license = await octoCatch(octo.rest.licenses.getForRepo(args))
    if (license.isErr) {
        if (license.err.status === 404) {
            return err({ type: 'license-not-found' })
        } else {
            return err({ type: 'octo-error', err: license.err.error() })
        }
    }

    let spdxId = license.val.license?.spdx_id
    if (!spdxId) return err({ type: 'license-not-found' })
    if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
        return err({ type: 'license-not-supported', spdxId })
    }

    return ok()
}

export function parseGithubUrl(raw: string): Result<{ owner: string; repo: string }> {
    // Handle URLs that start with github.com without protocol
    let urlString = raw
    if (!raw.includes('://') && raw.startsWith('github.com')) {
        urlString = 'https://' + raw
    }

    let url: URL
    try {
        url = new URL(urlString)
    } catch {
        return err('invalid github url')
    }

    if (url.hostname !== 'github.com') return err('invalid github url')

    let parts = url.pathname.split('/')
    if (parts.length < 3) return err('invalid github url')

    let owner = parts[1]
    let repo = parts[2]

    if (!owner || !repo) return err('invalid github url')

    return ok({ owner, repo })
}

export async function getRateLimit(octo: Octokit) {
    let rateLimit = await octoCatchFull(octo.rest.rateLimit.get())
    if (rateLimit.isErr) {
        return octoWrap('failed to get rate limit', rateLimit)
    }

    let limit = rateLimit.val.headers['x-ratelimit-limit']
    let remaining = rateLimit.val.headers['x-ratelimit-remaining']
    let reset = rateLimit.val.headers['x-ratelimit-reset']

    return ok({ limit, remaining, reset })
}
