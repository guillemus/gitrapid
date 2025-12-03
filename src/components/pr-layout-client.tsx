'use client'

import { PrefetchLink } from '@/components/prefetch-link'
import { qcDefault, qcopts } from '@/query-client'
import { useQuery } from '@tanstack/react-query'
import { useParams, usePathname } from 'next/navigation'

export function PRLayoutClient(props: { children: React.ReactNode }) {
    let params = useParams<{
        owner: string
        repo: string
        number: string
    }>()
    let pathname = usePathname()

    let pr = useQuery(qcopts.getPR(params.owner, params.repo, Number(params.number)))
    let data = pr.data

    let isFilesTab = pathname.endsWith('/files')

    return (
        <div className="min-h-screen p-8 font-sans">
            <div className="mb-4">
                <PrefetchLink
                    onPrefetch={() => {
                        qcDefault.prefetchQuery(qcopts.listPRs(params.owner, params.repo))
                    }}
                    href={`/${params.owner}/${params.repo}/pulls`}
                    className="text-blue-600 hover:underline block"
                >
                    &larr; Back to {params.owner}/{params.repo}/pulls
                </PrefetchLink>
            </div>
            {!pr.isLoading && (
                <>
                    <h1 className="text-2xl font-bold mb-2">
                        #{data?.number} {data?.title}
                    </h1>
                    <div className="flex items-center gap-2 mb-4">
                        <span
                            className={`text-sm px-2 py-0.5 rounded ${
                                data?.state === 'open'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-purple-100 text-purple-800'
                            }`}
                        >
                            {data?.state}
                        </span>
                        <span className="text-zinc-500">opened by {data?.user?.login}</span>
                    </div>

                    <div className="border-b mb-4">
                        <div className="flex gap-4">
                            <PrefetchLink
                                href={`/${params.owner}/${params.repo}/pull/${params.number}`}
                                className={`px-4 py-2 -mb-px ${
                                    !isFilesTab
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                }`}
                            >
                                Conversation
                            </PrefetchLink>
                            <PrefetchLink
                                onPrefetch={() => {
                                    qcDefault.prefetchQuery(
                                        qcopts.getPRFiles(
                                            params.owner,
                                            params.repo,
                                            Number(params.number),
                                        ),
                                    )
                                }}
                                href={`/${params.owner}/${params.repo}/pull/${params.number}/files`}
                                className={`px-4 py-2 -mb-px ${
                                    isFilesTab
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                }`}
                            >
                                Files changed
                            </PrefetchLink>
                        </div>
                    </div>

                    {props.children}
                </>
            )}
        </div>
    )
}
