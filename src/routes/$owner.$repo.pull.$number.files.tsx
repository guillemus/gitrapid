import { DiffViewer, FileTreeSidebar } from '@/components/diff-viewer'
import { qcopts } from '@/query-client'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/pull/$number/files')({
    loader: async ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        queryClient.prefetchQuery(qcopts.getPRFiles(params.owner, params.repo, number))
    },
    component: PRFilesPage,
})

function PRFilesPage() {
    const params = Route.useParams()
    const number = Number(params.number)

    const prFiles = useQuery(qcopts.getPRFiles(params.owner, params.repo, number))

    if (prFiles.isLoading) {
        return <div>Loading files...</div>
    }

    if (prFiles.error) {
        return <div>Error: {String(prFiles.error)}</div>
    }

    if (!prFiles.data) {
        return <div>No data loaded</div>
    }

    return (
        <div className="flex gap-6">
            <FileTreeSidebar files={prFiles.data} />
            <div className="flex-1 min-w-0">
                <DiffViewer files={{ data: prFiles.data }} />
            </div>
        </div>
    )
}
