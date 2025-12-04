import { PRLayoutClient } from '@/components/pr-layout-client'
import { qcopts } from '@/query-client'
import { ClientOnly, createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pull/$number')({
    loader: async ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        queryClient.prefetchQuery(qcopts.getPR(params.owner, params.repo, number))
    },
    component: PRPage,
})

function PRPage() {
    return (
        <ClientOnly>
            <PRLayoutClient>
                <Outlet />
            </PRLayoutClient>
        </ClientOnly>
    )
}
