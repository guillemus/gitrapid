import { HeaderWithTitle } from '@/components/header'
import { PageContainer } from '@/components/layouts'
import { RepoListItem } from '@/components/repo-list-item'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/server/trpc-client'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
    component: RouteComponent,
    loader({ context: { queryClient } }) {
        void queryClient.prefetchQuery(trpc.listMyRepos.queryOptions())
    },
})

function RouteComponent() {
    const user = useQuery(trpc.getUser.queryOptions())
    const repos = useQuery(trpc.listMyRepos.queryOptions())

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <HeaderWithTitle title="Dashboard"></HeaderWithTitle>

            <div className="flex-1">
                <PageContainer>
                    <div className="p-4">
                        <h1 className="text-xl font-semibold text-zinc-900 mb-1">
                            Welcome back, {user.data?.user.name}!
                        </h1>
                        <p className="text-sm text-zinc-600">Your recent repositories</p>
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
            {Array.from({ length: 5 }).map((_, i) => (
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
