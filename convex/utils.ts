import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server'
import { api } from './_generated/api'
import type { GithubClient } from './GithubClient'

export interface Context {
    runQuery<Query extends FunctionReference<'query'>>(
        query: Query,
        ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>>
    runMutation<Mutation extends FunctionReference<'mutation'>>(
        mutation: Mutation,
        ...args: OptionalRestArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>>
}

type RefAndPath = {
    ref: string
    path: string
    isCommit: boolean
}

const commitShaRegex = /^[a-f0-9]{40}$/i

export function parseRefAndPath(repoRefsSet: Set<string>, refAndPath: string): RefAndPath | null {
    let parts = refAndPath.split('/')
    let acc = ''
    let lastValidRef = ''

    if (refAndPath === '') {
        return {
            ref: 'HEAD',
            path: 'README.md',
            isCommit: false,
        }
    }

    let firstPart = parts[0]

    if (firstPart && commitShaRegex.test(firstPart)) {
        let path = parts.slice(1).join('/')
        if (path === '') {
            path = 'README.md'
        }

        return { ref: firstPart, path, isCommit: true }
    }

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
            return { ref: lastValidRef, path, isCommit: false }
        }
    }

    // Handle case where the entire string is a valid ref (no path)
    if (repoRefsSet.has(refAndPath)) {
        return { ref: refAndPath, path: 'README.md', isCommit: false }
    }

    return null
}

export async function downloadAllRefs(
    ctx: Context,
    githubClient: GithubClient,
    owner: string,
    repoName: string,
) {
    let repo = await ctx.runQuery(api.functions.getRepo, {
        owner,
        repo: repoName,
    })

    let repoId = repo?._id

    if (!repoId) {
        repoId = await ctx.runMutation(api.functions.insertRepo, {
            owner,
            repo: repoName,
        })
    }

    let fetchedRefs: {
        sha: string
        ref: string
    }[] = []

    let page = 0
    while (true) {
        console.log('fetching branches page', page, 'for', owner, repoName)

        let refs
        refs = await githubClient.listBranches(owner, repoName, page)
        if (refs.error) {
            console.error(refs.error)
            throw refs.error
        }

        refs = refs.data

        if (refs.length === 0) {
            break
        }

        for (let ref of refs) {
            let sha = ref.commit.sha
            fetchedRefs.push({ sha, ref: ref.name })
        }

        page++
    }

    page = 0
    while (true) {
        console.log('fetching tags page', page, 'for', owner, repoName)

        let tags
        tags = await githubClient.listTags(owner, repoName, page)
        if (tags.error) {
            console.error(tags.error)
            throw tags.error
        }

        tags = tags.data

        if (tags.length === 0) {
            break
        }

        for (let tag of tags) {
            let sha = tag.commit.sha
            fetchedRefs.push({ sha, ref: tag.name })
        }

        page++
    }

    console.log('total fetched refs', fetchedRefs.length)

    console.log('updating refs')
    await ctx.runMutation(api.functions.upsertCommitsAndRefs, {
        repo: repoId,
        refs: fetchedRefs,
    })

    console.log('fetching filenames for each commit')

    let commits = await ctx.runQuery(api.functions.getAllRepoCommitsWithoutFiles, {
        repoId: repoId,
    })

    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i]!
        console.log(
            `processing commit ${i + 1}/${commits.length}: getting tree for`,
            owner,
            repoName,
            commit.sha,
        )
        let allFiles = await githubClient.getRepoTree(owner, repoName, commit.sha)
        if (allFiles.error) {
            console.error(allFiles.error)
            continue
        }

        let fileNames = allFiles.data.tree.map((f) => f.path)
        console.log('upserting', fileNames.length, 'files for commit', commit.sha)

        await ctx.runMutation(api.functions.upsertFiles, {
            commitId: commit._id,
            fileNames: fileNames,
        })

        console.log(`finished upserting commit ${commit.sha}`)
    }
}

type TreeNode = {
    [folderName: string]: (string | TreeNode)[]
}

export function buildFileTree(filePaths: string[]): TreeNode {
    // Group paths by their root directory
    const groups: { [rootDir: string]: string[] } = {}

    for (const path of filePaths) {
        const parts = path.split('/').filter((part) => part.length > 0)
        if (parts.length === 0) continue

        const rootDir = parts[0]
        if (!rootDir) continue

        if (!groups[rootDir]) {
            groups[rootDir] = []
        }
        groups[rootDir].push(path)
    }

    const result: TreeNode = {}

    for (const [rootDir, paths] of Object.entries(groups)) {
        result[rootDir] = []

        // Separate files in root vs subdirectories
        const filesInRoot: string[] = []
        const subPaths: string[] = []

        for (const path of paths) {
            const parts = path.split('/').filter((part) => part.length > 0)
            if (parts.length === 1) {
                const fileName = parts[0]
                if (fileName) filesInRoot.push(fileName)
            } else {
                subPaths.push(parts.slice(1).join('/'))
            }
        }

        // Add files directly to the array
        result[rootDir].push(...filesInRoot)

        // If there are subdirectories, create a nested object
        if (subPaths.length > 0) {
            const subTree = buildFileTree(subPaths)
            result[rootDir].push(subTree)
        }
    }

    return result
}
