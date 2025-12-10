import { PRLayoutClient } from '@/components/pr-layout-client'
import { trpc } from '@/server/trpc-client'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pull/$number')({
    loader: async ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        queryClient.prefetchQuery(
            trpc.getPR.queryOptions({ owner: params.owner, repo: params.repo, number }),
        )
        queryClient.prefetchQuery(
            trpc.getPRFiles.queryOptions({ owner: params.owner, repo: params.repo, number }),
        )
    },
    component: PRPage,
})

function PRPage() {
    return (
        <PRLayoutClient>
            <Outlet />
        </PRLayoutClient>
    )
}
