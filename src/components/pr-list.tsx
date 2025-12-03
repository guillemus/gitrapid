'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PrefetchLink } from '@/components/prefetch-link'
import { Button } from '@/components/ui/button'
import { qcDefault, qcopts } from '@/query-client'

export function PRList() {
    let params = useParams<{ owner: string; repo: string }>()
    let [page, setPage] = useState(1)
    const prs = useQuery(qcopts.listPRs(params.owner, params.repo, page))

    return (
        <div className="min-h-screen p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4">
                {params.owner}/{params.repo} - Pull Requests
            </h1>
            <div>
                <Button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                    prev
                </Button>
                <Button onClick={() => setPage((p) => p + 1)}>next</Button>
            </div>
            <div className="space-y-2">
                {prs.data?.map((pr) => (
                    <PrefetchLink
                        onPrefetch={() => {
                            qcDefault.prefetchQuery(
                                qcopts.getPR(params.owner, params.repo, pr.number),
                            )
                            qcDefault.prefetchQuery(
                                qcopts.getPRFiles(params.owner, params.repo, pr.number),
                            )
                        }}
                        key={pr.number}
                        href={`/${params.owner}/${params.repo}/pull/${pr.number}`}
                        className="block p-4 border rounded hover:bg-zinc-100"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500">#{pr.number}</span>
                            <span className="font-medium">{pr.title}</span>
                            <span
                                className={`text-sm px-2 py-0.5 rounded ${
                                    pr.state === 'open'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-purple-100 text-purple-800'
                                }`}
                            >
                                {pr.state}
                            </span>
                        </div>
                    </PrefetchLink>
                ))}
            </div>
        </div>
    )
}
