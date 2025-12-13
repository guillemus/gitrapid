import { Skeleton } from '@/components/ui/skeleton'
import { qc } from '@/lib'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useMemo } from 'react'

export const Route = createFileRoute('/$owner/$repo/blob/$')({
    component: BlobRedirect,
    loader({ params, context: { queryClient } }) {
        void queryClient.prefetchQuery(qc.refs({ owner: params.owner, repo: params.repo }))
    },
})

function disambiguateRefAndPath(
    segments: string[],
    refs: string[],
): { ref: string; path: string } | null {
    // Try longest match first (most specific ref)
    for (let i = segments.length; i >= 1; i--) {
        const candidateRef = segments.slice(0, i).join('/')
        if (refs.includes(candidateRef)) {
            const path = segments.slice(i).join('/')
            return { ref: candidateRef, path }
        }
    }
    return null
}

/**
 * Handles GitHub-style blob URLs: /owner/repo/blob/feature/foo/src/file.ts
 *
 * Both ref and path can have slashes (e.g. ref="feature/foo", path="src/file.ts"),
 * so parsing requires fetching all refs to disambiguate. If we do this for every page
 * page navigation it is a bit expensive.
 *
 * This route fetches refs once, disambiguates via longest match, then redirects
 * to query param URL, so that we do the work once.
 *
 * With ref as a stable query param (between page navigations on the code page),
 * we don't need to fetch new file tree data when navigating between pages.
 *
 * TODO: there are probably workarounds to better handle this.
 */
function BlobRedirect() {
    const params = Route.useParams()
    const navigate = useNavigate()

    const refsQuery = useQuery(qc.refs({ owner: params.owner, repo: params.repo }))

    const splat = params._splat ?? ''
    const segments = useMemo(() => splat.split('/').filter(Boolean), [splat])

    const onRefsLoaded = useEffectEvent((refs: string[]) => {
        const result = disambiguateRefAndPath(segments, refs)

        if (result) {
            void navigate({
                to: '/$owner/$repo',
                params: { owner: params.owner, repo: params.repo },
                search: { ref: result.ref, path: result.path || undefined },
                replace: true,
            })
        } else {
            // No matching ref found - assume first segment is ref, rest is path
            const assumedRef = segments[0]
            const assumedPath = segments.slice(1).join('/')
            void navigate({
                to: '/$owner/$repo',
                params: { owner: params.owner, repo: params.repo },
                search: {
                    ref: assumedRef || undefined,
                    path: assumedPath || undefined,
                },
                replace: true,
            })
        }
    })

    useEffect(() => {
        if (!refsQuery.data || refsQuery.data.length === 0) {
            return
        }

        onRefsLoaded(refsQuery.data)
    }, [refsQuery.data])

    if (refsQuery.isError) {
        return (
            <div className="flex-1 p-6">
                <div className="text-red-500">Error resolving ref</div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-64px)]">
            <div className="w-80 border-r border-border p-4 overflow-y-auto">
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-6 w-5/6 mb-2" />
            </div>
            <div className="flex-1 p-6">
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-3/4 mb-2" />
            </div>
        </div>
    )
}
