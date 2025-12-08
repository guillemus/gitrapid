import { HeaderOwner } from '@/components/header'
import { PageContainer } from '@/components/page-container'
import { RepoListItem } from '@/components/repo-list-item'
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { qcopts } from '@/query-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/$owner/')({
    validateSearch: z.object({
        page: z.coerce.number().default(1),
    }),
    component: OwnerRepos,
    loader: async ({ context: { queryClient }, params }) => {
        queryClient.prefetchQuery(qcopts.listOwnerRepos(params.owner, 1))
    },
})

function OwnerRepos() {
    const params = Route.useParams()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const queryClient = useQueryClient()

    const repos = useQuery(qcopts.listOwnerRepos(params.owner, search.page))
    const hasNext = repos.data?.length === 10

    const handlePrevPage = () => {
        if (search.page > 1) {
            navigate({ search: { page: search.page - 1 } })
        }
    }

    const handleNextPage = () => {
        navigate({ search: { page: search.page + 1 } })
    }

    const prefetchPrev = () => {
        if (search.page > 1) {
            queryClient.prefetchQuery(qcopts.listOwnerRepos(params.owner, search.page - 1))
        }
    }

    const prefetchNext = () => {
        queryClient.prefetchQuery(qcopts.listOwnerRepos(params.owner, search.page + 1))
    }

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <HeaderOwner owner={params.owner}></HeaderOwner>

            {/* Content */}
            <div className="flex-1">
                <PageContainer>
                    <div className="flex items-center justify-between p-4">
                        <span className="text-sm text-zinc-600">Repositories</span>

                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={handlePrevPage}
                                        onMouseEnter={prefetchPrev}
                                        onMouseDown={prefetchPrev}
                                        disabled={search.page === 1}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink isActive>{search.page}</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={handleNextPage}
                                        onMouseEnter={prefetchNext}
                                        onMouseDown={prefetchNext}
                                        disabled={!hasNext}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>

                    <div className="border border-zinc-200 rounded-md overflow-hidden">
                        {repos.isLoading ? (
                            <RepoListSkeleton />
                        ) : repos.data?.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">
                                No repositories found
                            </div>
                        ) : (
                            repos.data?.map((repo) => <RepoListItem key={repo.name} repo={repo} />)
                        )}
                    </div>
                </PageContainer>
            </div>
        </div>
    )
}

function RepoListSkeleton() {
    return (
        <>
            {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="p-3 border-b border-zinc-200 last:border-b-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Skeleton className="w-24 h-4" />
                                <Skeleton className="w-16 h-3" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-48 h-3" />
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <Skeleton className="w-12 h-3" />
                        </div>
                    </div>
                </div>
            ))}
        </>
    )
}
