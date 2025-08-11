import type { Doc, Id } from '@convex/_generated/dataModel'
import type { QueryCtx } from '@convex/_generated/server'
import * as models from '@convex/models/models'
import { err } from '@convex/utils'

export async function getRepoPageQuery(
    ctx: QueryCtx,
    userId: Id<'users'>,
    owner: string,
    repo: string,
    refAndPath: string,
) {
    let savedRepo = await models.Repos.getByOwnerAndRepo(ctx, owner, repo)
    if (!savedRepo) {
        return err(`getRepoPage: repo not found ${owner}/${repo}`)
    }
    let repoId = savedRepo._id

    let installation = await models.Installations.getByUserIdAndRepoId(ctx, userId, repoId)
    if (!installation) {
        return err(`getRepoPage: user ${userId} not authorized to this page`)
    }

    let refs = await models.Refs.getRefsFromRepo(ctx, repoId)
    let headRef = refs.find((ref) => ref._id === savedRepo.headId)
    if (!headRef) {
        return err(`getRepoPage: head ref not found ${owner}/${repo}`)
    }

    let parsedRefAndPath = parseRefAndPath(refs, headRef, refAndPath)
    if (!parsedRefAndPath) {
        return err(`getRepoPage: error parsing ref and path ${owner}/${repo} ${refAndPath}`)
    }

    let commit = await models.Commits.getByRepoAndSha(ctx, repoId, parsedRefAndPath.ref.commitSha)
    if (!commit) {
        return err(`getRepoPage: commit not found ${owner}/${repo} ${refAndPath}`)
    }

    let tree = await models.Trees.getByRepoAndSha(ctx, repoId, commit.treeSha)
    if (!tree) {
        return err(`getRepoPage: tree not found ${owner}/${repo} ${refAndPath}`)
    }

    let treeEntries = await models.TreeEntries.getByRepoAndTree(ctx, repoId, tree.sha)
    let treeEntry = treeEntries.find((t) => t.path === parsedRefAndPath.path)
    if (!treeEntry) {
        return err(`getRepoPage: tree entry not found ${owner}/${repo} ${refAndPath}`)
    }

    let filenames = treeEntries.map((t) => t.path)

    let blob = await models.Blobs.getByRepoAndSha(ctx, repoId, treeEntry.entrySha)
    if (!blob) {
        return err(`getRepoPage: blob not found ${owner}/${repo} ${refAndPath}`)
    }

    return {
        ref: parsedRefAndPath.ref,
        path: parsedRefAndPath.path,
        filenames,
        repoId,
        fileContents: blob.content,
    }
}

const commitShaRegex = /^[a-f0-9]{40}$/i

export function parseRefAndPath(
    repoRefs: Doc<'refs'>[],
    headRef: Doc<'refs'>,
    refAndPath: string,
): { ref: Doc<'refs'>; path: string } | null {
    let repoRefsSet = new Set(repoRefs.map((r) => r.name))

    if (refAndPath === '') {
        return { ref: headRef, path: 'README.md' }
    }

    let parts = refAndPath.split('/')
    let acc = ''
    let lastValidRef = ''

    for (let part of parts) {
        if (acc === '') {
            acc = part
        } else {
            acc = `${acc}/${part}`
        }

        if (repoRefsSet.has(acc)) {
            lastValidRef = acc
            continue
        }

        if (lastValidRef !== '') {
            let path = refAndPath.slice(lastValidRef.length)
            if (path.startsWith('/')) {
                path = path.slice(1)
            }
            if (path === '') {
                path = 'README.md'
            }

            let ref = repoRefs.find((r) => r.name === lastValidRef)
            if (!ref) return null

            return { ref, path }
        }
    }

    let firstPart = parts[0]

    if (firstPart && commitShaRegex.test(firstPart)) {
        let path = parts.slice(1).join('/')
        if (path === '') {
            let ref = repoRefs.find((r) => r.name === firstPart)
            if (!ref) return null

            return { ref, path: 'README.md' }
        }

        let ref = repoRefs.find((r) => r.name === firstPart)
        if (!ref) return null

        return { ref, path }
    }

    if (repoRefsSet.has(refAndPath)) {
        let ref = repoRefs.find((r) => r.name === refAndPath)
        if (!ref) return null

        return { ref, path: 'README.md' }
    }

    return null
}
