import { PrefetchLink } from '@/components/prefetch-link'
import { qcopts } from '@/query-client'
import { GitPullRequestClosedIcon, GitPullRequestIcon } from '@primer/octicons-react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouterState } from '@tanstack/react-router'

export function PRLayoutClient(props: { children: React.ReactNode }) {
    let params = useParams({ strict: false }) as {
        owner: string
        repo: string
        number: string
    }
    let routerState = useRouterState()
    let pathname = routerState.location.pathname

    let pr = useQuery(qcopts.useGetPROpts(params.owner, params.repo, Number(params.number)))
    let data = pr.data

    let isFilesTab = pathname.endsWith('/files')

    return (
        <div className="min-h-screen p-8 font-sans">
            <div className="mb-4">
                <PrefetchLink
                    to="/$owner/$repo/pulls"
                    params={{ owner: params.owner, repo: params.repo }}
                    className="text-blue-600 hover:underline block"
                >
                    &larr; Back to {params.owner}/{params.repo}/pulls
                </PrefetchLink>
            </div>
            {!pr.isLoading && (
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
                        <span className="text-zinc-500">
                            {data?.user?.login} wants to merge {data?.changed_files} commits into{' '}
                            {data?.base.repo.owner.login}:{data?.base.ref} from{' '}
                            {data?.head.repo?.owner.login}:{data?.head.ref}
                        </span>
                        <span className="text-sm text-zinc-500">
                            <span className="text-green-600">+{data?.additions}</span>{' '}
                            <span className="text-red-600">-{data?.deletions}</span>
                        </span>
                    </div>

                    <div className="border-b mb-4">
                        <div className="flex gap-4">
                            <PrefetchLink
                                to="/$owner/$repo/pull/$number"
                                params={params}
                                className={`px-4 py-2 -mb-px ${
                                    !isFilesTab
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                }`}
                            >
                                Conversation
                            </PrefetchLink>
                            <PrefetchLink
                                to="/$owner/$repo/pull/$number/files"
                                params={{
                                    owner: params.owner,
                                    repo: params.repo,
                                    number: params.number,
                                }}
                                className={`px-4 py-2 -mb-px ${
                                    isFilesTab
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                }`}
                            >
                                Files{data?.changed_files ? ` (${data.changed_files})` : ''}
                            </PrefetchLink>
                        </div>
                    </div>

                    {props.children}
                </>
            )}
        </div>
    )
}
