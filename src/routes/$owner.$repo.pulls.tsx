import { PRList } from '@/components/pr-list'
import { qcopts } from '@/query-client'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pulls')({
    loader: async ({ context: { queryClient }, params }) => {
        queryClient.prefetchQuery(qcopts.listPRs(params.owner, params.repo))
    },
    component: PRListPage,
})

function PRListPage() {
    return (
        <div className="min-h-screen p-8 font-sans">
            <ClientOnly>
                <PRList />
            </ClientOnly>
        </div>
    )
}
