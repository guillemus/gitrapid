import { createFileRoute } from '@tanstack/react-router'
import { PRConversation } from '@/components/pr-conversation'
import { PRLayoutClient } from '@/components/pr-layout-client'
import { qcopts } from '@/query-client'

export const Route = createFileRoute('/$owner/$repo/pull/$number')({
    loader: async ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        queryClient.prefetchQuery(qcopts.getPR(params.owner, params.repo, number))
        queryClient.prefetchQuery(qcopts.getPRComments(params.owner, params.repo, number, 1))
    },
    component: PRPage,
})

function PRPage() {
    return (
        <PRLayoutClient>
            <PRConversation />
        </PRLayoutClient>
    )
}
