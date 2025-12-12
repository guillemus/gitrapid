import { PRConversation } from '@/components/pr-conversation'
import { trpc } from '@/server/trpc-client'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pull/$number/')({
    loader: ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        void queryClient.prefetchQuery(
            trpc.getPRComments.queryOptions({ owner: params.owner, repo: params.repo, number }),
        )
    },
    component: PRConversationPage,
})

function PRConversationPage() {
    let params = Route.useParams()
    return <PRConversation params={params} />
}
