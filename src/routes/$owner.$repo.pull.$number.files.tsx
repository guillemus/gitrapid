import { createFileRoute } from '@tanstack/react-router'
import { DiffViewer, FileTreeSidebar } from '@/components/diff-viewer'
import { PRLayoutClient } from '@/components/pr-layout-client'
import { qcopts } from '@/query-client'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/$owner/$repo/pull/$number/files')({
    loader: async ({ context: { queryClient }, params }) => {
        const number = Number(params.number)
        queryClient.ensureQueryData(qcopts.getPR(params.owner, params.repo, number))
        queryClient.ensureQueryData(qcopts.getPRFiles(params.owner, params.repo, number))
    },
    component: PRFilesPage,
})

function PRFilesPage() {
    const params = Route.useParams()
    const number = Number(params.number)

    const prFiles = useQuery(qcopts.getPRFiles(params.owner, params.repo, number))

    return (
        <PRLayoutClient>
            {prFiles.isLoading && <div>Loading files...</div>}
            {prFiles.data && (
                <div className="flex gap-6">
                    <FileTreeSidebar files={prFiles.data} />
                    <div className="flex-1 min-w-0">
                        <DiffViewer files={{ data: prFiles.data }} />
                    </div>
                </div>
            )}
        </PRLayoutClient>
    )
}
