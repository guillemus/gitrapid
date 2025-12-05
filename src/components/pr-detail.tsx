import { DiffViewer, FileTreeSidebar } from '@/components/diff-viewer'
import { PrefetchLink } from '@/components/prefetch-link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { qcopts } from '@/query-client'
import { GitPullRequestClosedIcon, GitPullRequestIcon } from '@primer/octicons-react'
import { useQueries } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'

export function PRDetail() {
    let props = useParams({ strict: false }) as {
        owner: string
        repo: string
        number: string
    }

    let [pr, prFiles] = useQueries({
        queries: [
            qcopts.useGetPROpts(props.owner, props.repo, Number(props.number)),
            qcopts.getPRFiles(props.owner, props.repo, Number(props.number)),
        ],
    })

    const data = pr.data
    let loading = pr.isLoading || prFiles.isLoading

    return (
        <>
            <div className="mb-4">
                <PrefetchLink
                    to={`/$owner/$repo/pulls`}
                    params={{ owner: props.owner, repo: props.repo }}
                    className="text-blue-600 hover:underline block"
                >
                    &larr; Back to {props.owner}/{props.repo}/pulls
                </PrefetchLink>
            </div>
            {!loading && (
                <>
                    <h1 className="text-2xl font-bold mb-2">
                        #{data?.number} {data?.title}
                    </h1>
                    <div className="flex items-center gap-2 mb-4">
                        <div
                            className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded ${
                                data?.state === 'open'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-purple-100 text-purple-800'
                            }`}
                        >
                            {data?.state === 'open' ? (
                                <GitPullRequestIcon size={12} />
                            ) : (
                                <GitPullRequestClosedIcon size={12} />
                            )}
                            {data?.state}
                        </div>
                        <span className="text-zinc-500">opened by {data?.user?.login}</span>
                    </div>

                    <Tabs defaultValue="conversation" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="conversation">Conversation</TabsTrigger>
                            <TabsTrigger value="files">
                                Files changed {prFiles.data ? prFiles.data.length : 0}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="conversation">
                            {data?.body && (
                                <div className="border rounded p-4 whitespace-pre-wrap">
                                    {data.body}
                                </div>
                            )}
                            {!data?.body && (
                                <div className="text-zinc-500 italic">No description provided.</div>
                            )}
                        </TabsContent>

                        <TabsContent value="files">
                            {prFiles.data && (
                                <div className="flex gap-6">
                                    <FileTreeSidebar files={prFiles.data} />
                                    <div className="flex-1 min-w-0">
                                        <DiffViewer files={{ data: prFiles.data }} />
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </>
    )
}
