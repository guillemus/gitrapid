import { PRConversation } from '@/components/pr-conversation'
import { qcopts } from '@/query-client'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pull/$number/')({
    loader: async ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        queryClient.prefetchQuery(qcopts.getPRComments(params.owner, params.repo, number, 1))
    },
    component: PRConversationPage,
})

function PRConversationPage() {
    return <PRConversation />
}
