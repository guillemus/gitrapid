import { PRLayoutClient } from '@/components/pr-layout-client'
import { trpc } from '@/server/trpc-client'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pull/$number')({
    loader: ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        void queryClient.prefetchQuery(
            trpc.getPR.queryOptions({ owner: params.owner, repo: params.repo, number }),
        )
        void queryClient.prefetchQuery(
            trpc.getPRFiles.queryOptions({ owner: params.owner, repo: params.repo, number }),
        )
    },
    component: PRPage,
})

function PRPage() {
    let params = Route.useParams()
    return (
        <PRLayoutClient params={params}>
            <Outlet />
        </PRLayoutClient>
    )
}
