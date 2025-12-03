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
                        className="block p-3 border border-zinc-200 hover:bg-zinc-50"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-zinc-500">#{pr.number}</span>
                                    <span className="font-medium truncate">{pr.title}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-zinc-600">
                                    <span>
                                        opened{' '}
                                        {new Date(pr.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                        })}{' '}
                                        by {pr.user?.login}
                                    </span>
                                    {pr.milestone && (
                                        <span className="flex items-center gap-1">
                                            <span>•</span>
                                            <span>{pr.milestone.title}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {pr.labels && pr.labels.length > 0 && (
                                    <div className="flex gap-1">
                                        {pr.labels.slice(0, 3).map((label) => (
                                            <span
                                                key={label.id}
                                                className="text-xs px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: `#${label.color}20`,
                                                    color: `#${label.color}`,
                                                    border: `1px solid #${label.color}40`,
                                                }}
                                            >
                                                {label.name}
                                            </span>
                                        ))}
                                        {pr.labels.length > 3 && (
                                            <span className="text-xs text-zinc-500">
                                                +{pr.labels.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </PrefetchLink>
                ))}
            </div>
        </div>
    )
}
