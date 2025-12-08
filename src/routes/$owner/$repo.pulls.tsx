import { PRList } from '@/components/pr-list'
import { qcopts } from '@/query-client'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/$owner/$repo/pulls')({
    validateSearch: z.object({
        page: z.coerce.number().default(1),
        state: z.enum(['open', 'closed']).default('open'),
    }),
    loader: async ({ context: { queryClient }, params }) => {
        // For now, prefetch default open page 1
        // The component will handle other states/pages
        queryClient.prefetchQuery(qcopts.listPRs(params.owner, params.repo, 1, 'open'))
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
