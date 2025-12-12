import { DiffViewer } from '@/components/diff-viewer'
import { trpc } from '@/server/trpc-client'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pull/$number/files')({
    loader: ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        void queryClient.prefetchQuery(
            trpc.getPRFiles.queryOptions({ owner: params.owner, repo: params.repo, number }),
        )
    },
    component: PRFilesPage,
})

function PRFilesPage() {
    const params = Route.useParams()
    const number = Number(params.number)

    const prFiles = useQuery(
        trpc.getPRFiles.queryOptions({ owner: params.owner, repo: params.repo, number }),
    )

    if (prFiles.isLoading) {
        return <div>Loading files...</div>
    }

    if (prFiles.error) {
        return <div>Error: {prFiles.error.message}</div>
    }

    if (!prFiles.data) {
        return <div>No data loaded</div>
    }

    return (
        <div className="flex gap-6">
            {/* <FileTreeSidebar files={prFiles.data} /> */}
            <div className="flex-1 min-w-0 pb-6">
                <DiffViewer files={{ data: prFiles.data }} />
            </div>
        </div>
    )
}
