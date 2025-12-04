import { createFileRoute } from '@tanstack/react-router'
import { PRList } from '@/components/pr-list'
import { qcopts } from '@/query-client'

export const Route = createFileRoute('/$owner/$repo/pulls')({
    loader: async ({ context: { queryClient }, params }) => {
        queryClient.prefetchQuery(qcopts.listPRs(params.owner, params.repo))
    },
    component: PRListPage,
})

function PRListPage() {
    return (
        <div className="min-h-screen p-8 font-sans">
            <PRList />
        </div>
    )
}
