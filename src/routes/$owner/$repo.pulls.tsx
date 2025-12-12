import { PRList } from '@/components/pr-list'
import { trpc } from '@/server/trpc-client'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/$owner/$repo/pulls')({
    validateSearch: z.object({
        page: z.coerce.number().default(1),
        state: z.enum(['open', 'closed']).default('open'),
    }),
    loader: ({ context: { queryClient }, params }) => {
        // For now, prefetch default open page 1
        // The component will handle other states/pages
        void queryClient.prefetchQuery(
            trpc.listPRs.queryOptions({
                owner: params.owner,
                repo: params.repo,
                page: 1,
                state: 'open',
            }),
        )
    },
    component: PRListPage,
})

function PRListPage() {
    return (
        <ClientOnly>
            <PRList />
        </ClientOnly>
    )
}
