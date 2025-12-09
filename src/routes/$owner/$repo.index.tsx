import { qc } from '@/lib'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

let search = z.object({
    ref: z.string().optional(),
    path: z.string().optional(),
})

export const Route = createFileRoute('/$owner/$repo/')({
    validateSearch: search,
    component: CodePage,
    loaderDeps: ({ search }) => ({ search }),
    loader({ params, deps: { search }, context: { queryClient } }) {
        queryClient.prefetchQuery(qc.fileTree({ owner: params.owner, repo: params.repo }))
        queryClient.prefetchQuery(
            qc.file({
                owner: params.owner,
                repo: params.repo,
                ref: search.ref,
                path: search.path,
            }),
        )
    },
})

function CodePage() {
    return <div className="flex"></div>
}
