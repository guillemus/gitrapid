'use client'

import { ClientOnly } from '@/components/client-only'
import { DiffViewer, FileTreeSidebar } from '@/components/diff-viewer'
import { qcopts } from '@/query-client'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'

export default function PRFilesPage() {
    let params = useParams<{
        owner: string
        repo: string
        number: string
    }>()

    let prFiles = useQuery(qcopts.getPRFiles(params.owner, params.repo, Number(params.number)))

    return (
        <ClientOnly>
            {prFiles.isLoading && <div>Loading files...</div>}
            {prFiles.data && (
                <div className="flex gap-6">
                    <FileTreeSidebar files={prFiles.data} />
                    <div className="flex-1 min-w-0">
                        <DiffViewer files={{ data: prFiles.data }} />
                    </div>
                </div>
            )}
        </ClientOnly>
    )
}
