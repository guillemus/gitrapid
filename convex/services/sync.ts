import { octoCatch } from '@convex/utils'
import type { Octokit } from 'octokit'
import { err, ok } from '../shared'

export async function validatePublicLicense(octo: Octokit, args: { owner: string; repo: string }) {
    let license = await octoCatch(octo.rest.licenses.getForRepo(args))
    if (license.isErr) {
        if (license.error.status === 404) {
            return err('license not found')
        } else {
            return err(license.error.error())
        }
    }

    let spdxId = license.val.license?.spdx_id
    if (!spdxId) return err('license-not-found')
    if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
        return err(`license-not-supported:${spdxId}`)
    }

    return ok('license-ok')
}
