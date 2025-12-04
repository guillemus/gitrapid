import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { PrefetchLink } from '@/components/prefetch-link'
import { Button } from '@/components/ui/button'
import { qcopts } from '@/query-client'

export function PRList() {
    let params = useParams({ strict: false }) as { owner: string; repo: string }
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
                    <PRListItem key={pr.number} pr={pr} owner={params.owner} repo={params.repo} />
                ))}
            </div>
        </div>
    )
}

function PRListItem(props: { owner: string; repo: string; pr: qcopts.ListPRsData[number] }) {
    let qc = useQueryClient()
    let prefetchOpts = qcopts.useGetPROpts(props.owner, props.repo, props.pr.number)

    return (
        <PrefetchLink
            onPrefetch={() => {
                qc.prefetchQuery(prefetchOpts)
                qc.prefetchQuery(qcopts.getPRFiles(props.owner, props.repo, props.pr.number))
            }}
            to={`/${props.owner}/${props.repo}/pull/${props.pr.number}`}
            className="block p-3 border border-zinc-200 hover:bg-zinc-50"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-zinc-500">#{props.pr.number}</span>
                        <span className="font-medium truncate">{props.pr.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <span>
                            opened{' '}
                            {new Date(props.pr.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                            })}{' '}
                            by {props.pr.user?.login}
                        </span>
                        {props.pr.milestone && (
                            <span className="flex items-center gap-1">
                                <span>•</span>
                                <span>{props.pr.milestone.title}</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {props.pr.labels && props.pr.labels.length > 0 && (
                        <div className="flex gap-1">
                            {props.pr.labels.slice(0, 3).map((label) => (
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
                            {props.pr.labels.length > 3 && (
                                <span className="text-xs text-zinc-500">
                                    +{props.pr.labels.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </PrefetchLink>
    )
}
