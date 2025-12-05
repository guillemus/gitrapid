import { PageContainer } from '@/components/page-container'
import { qcMem } from '@/query-client'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'

import { PrefetchLink } from '@/components/prefetch-link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { qcopts } from '@/query-client'
import { GitPullRequestClosedIcon, GitPullRequestIcon } from '@primer/octicons-react'

export function PRList() {
    const { owner, repo } = useParams({ strict: false })
    if (!owner || !repo) {
        throw new Error('PRList: owner or repo not provided')
    }

    const search = useSearch({ from: '/$owner/$repo/pulls' })
    const navigate = useNavigate({ from: '/$owner/$repo/pulls' })

    const handleStateChange = (newState: string) => {
        if (newState === 'open' || newState === 'closed') {
            navigate({ search: (old) => ({ ...old, state: newState, page: 1 }) })
        }
    }

    const handlePrevPage = () => {
        if (search.page > 1) {
            navigate({ search: (old) => ({ ...old, page: old.page - 1 }) })
        }
    }

    const handleNextPage = () => {
        navigate({ search: (old) => ({ ...old, page: old.page + 1 }) })
    }

    // Use qcMem for closed state, qcPersistent (router context) for open state
    const queryClient = search.state === 'closed' ? qcMem : undefined

    const prs = useQuery(qcopts.listPRs(owner, repo, search.page, search.state), queryClient)
    const hasNext = prs.data?.length === 10

    return (
        <div className="min-h-screen p-8 font-sans">
            <PageContainer>
                <h1 className="text-2xl font-bold mb-4">
                    {owner}/{repo} - Pull Requests
                </h1>

                <div className="flex items-center justify-between mb-4">
                    <Tabs value={search.state} onValueChange={handleStateChange}>
                        <TabsList>
                            <TabsTrigger value="open">Open</TabsTrigger>
                            <TabsTrigger value="closed">Closed</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-2">
                        <Button onMouseDown={handlePrevPage} disabled={search.page === 1}>
                            prev
                        </Button>
                        <span className="text-sm text-zinc-600">Page {search.page}</span>
                        <Button onMouseDown={handleNextPage} disabled={!hasNext}>
                            next
                        </Button>
                    </div>
                </div>

                <div className="mt-4 border border-zinc-200 rounded-md overflow-hidden">
                    {prs.isLoading ? (
                        <PRListSkeleton />
                    ) : (
                        prs.data?.map((pr) => (
                            <PRListItem key={pr.number} pr={pr} owner={owner} repo={repo} />
                        ))
                    )}
                </div>
            </PageContainer>
        </div>
    )
}

function PRListSkeleton() {
    return (
        <>
            {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="p-3 border-b border-zinc-200 last:border-b-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Skeleton className="w-4 h-4 rounded-full" />
                                <Skeleton className="w-8 h-4" />
                                <Skeleton className="w-48 h-4" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-32 h-3" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </>
    )
}

function PRListItem(props: { owner: string; repo: string; pr: qcopts.ListPRsData[number] }) {
    return (
        <PrefetchLink
            to="/$owner/$repo/pull/$number"
            params={{ owner: props.owner, repo: props.repo, number: String(props.pr.number) }}
            className="block p-3 hover:bg-zinc-50 border-b border-zinc-200 last:border-b-0"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {props.pr.state === 'open' ? (
                            <GitPullRequestIcon size={16} className="text-green-600" />
                        ) : (
                            <GitPullRequestClosedIcon size={16} className="text-purple-600" />
                        )}
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
