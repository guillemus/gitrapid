import type { Doc } from '@convex/_generated/dataModel'

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
