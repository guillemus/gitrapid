import { PrefetchLink } from '@/components/prefetch-link'
import { qcopts } from '@/query-client'
import { GitPullRequestClosedIcon, GitPullRequestIcon } from '@primer/octicons-react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouterState } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'

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
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
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
                        <div className="flex items-center gap-2 text-sm">
                            {data?.user?.avatar_url && (
                                <img
                                    src={data.user.avatar_url}
                                    alt={data.user.login}
                                    className="w-5 h-5 rounded-full"
                                />
                            )}
                            <span className="text-zinc-500">
                                <span className="font-medium text-zinc-900">
                                    {data?.user?.login}
                                </span>
                                {data?.created_at && (
                                    <>
                                        {' '}
                                        opened{' '}
                                        <span className="font-medium">
                                            {formatDistanceToNow(new Date(data.created_at), {
                                                addSuffix: true,
                                            })}
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>
                        <span className="text-zinc-500">
                            wants to merge {data?.changedFiles} commits into{' '}
                            {data?.base.repo.owner.login}:{data?.base.ref} from{' '}
                            {data?.head.repo?.owner.login}:{data?.head.ref}
                        </span>
                        <span className="text-sm text-zinc-500">
                            <span className="text-green-600">+{data?.additions}</span>{' '}
                            <span className="text-red-600">-{data?.deletions}</span>
                        </span>
                    </div>

                    {/* Labels and Milestone */}
                    {(data?.labels && data.labels.length > 0) || data?.milestone ? (
                        <div className="mb-4 flex gap-3 flex-wrap items-center">
                            {data?.labels && data.labels.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {data.labels.map((label) => (
                                        <span
                                            key={label.id}
                                            className="text-xs px-2 py-1 rounded"
                                            style={{
                                                backgroundColor: `#${label.color}`,
                                                color: getContrastColor(`#${label.color}`),
                                            }}
                                        >
                                            {label.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {data?.milestone && (
                                <span className="text-xs px-2 py-1 rounded border border-zinc-300">
                                    📍 {data.milestone.title}
                                </span>
                            )}
                        </div>
                    ) : null}

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
                                Files{data?.changedFiles ? ` (${data.changedFiles})` : ''}
                            </PrefetchLink>
                        </div>
                    </div>

                    {props.children}
                </>
            )}
        </div>
    )
}

function getContrastColor(hexColor: string): string {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 155 ? '#000000' : '#FFFFFF'
}
