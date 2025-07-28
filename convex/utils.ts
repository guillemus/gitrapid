import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server'

export interface Context {
    runQuery<Query extends FunctionReference<'query', 'internal' | 'public'>>(
        query: Query,
        ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>>
    runMutation<Mutation extends FunctionReference<'mutation', 'internal' | 'public'>>(
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

export function parseRefAndPath(repoRefs: string[], refAndPath: string): RefAndPath | null {
    let repoRefsSet = new Set(repoRefs)

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

export async function withExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 4,
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            if (attempt === maxRetries - 1) {
                console.error(`BACKOFF: Operation failed after ${maxRetries} attempts:`, error)
                throw error
            }

            const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s, 8s
            console.log(`BACKOFF: Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error)
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }
    throw new Error('BACKOFF: Should not reach here')
}
