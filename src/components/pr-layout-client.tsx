import { PageContainer } from '@/components/layouts'
import { PrefetchLink } from '@/components/prefetch-link'
import { qc } from '@/lib'
import type { PR } from '@/server/router'
import { GitPullRequestClosedIcon, GitPullRequestIcon } from '@primer/octicons-react'
import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'

export function PRLayoutClient(props: {
    children: React.ReactNode
    params: {
        owner: string
        repo: string
        number: string
    }
}) {
    let params = props.params
    let routerState = useRouterState()
    let pathname = routerState.location.pathname

    let pr = useQuery(qc.useGetPROpts(params.owner, params.repo, Number(params.number)))

    let isFilesTab = pathname.endsWith('/files')

    return (
        <PageContainer>
            <div className="mb-4"></div>
            {!pr.isLoading && (
                <>
                    <h1 className="text-2xl font-bold mb-2">
                        #{pr.data?.number} {pr.data?.title}
                    </h1>
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <div
                            className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full border ${
                                pr.data?.state === 'open'
                                    ? 'bg-green-700 text-white border-green-600'
                                    : 'bg-purple-700 text-white border-purple-600'
                            }`}
                        >
                            {pr.data?.state === 'open' ? (
                                <GitPullRequestIcon size={12} />
                            ) : (
                                <GitPullRequestClosedIcon size={12} />
                            )}
                            {pr.data?.state}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            {pr.data?.user.avatar_url && (
                                <img
                                    src={pr.data.user.avatar_url}
                                    alt={pr.data.user.login}
                                    className="w-5 h-5 rounded-full"
                                />
                            )}
                            <span className="text-muted-foreground">
                                <span className="font-medium text-foreground">
                                    {pr.data?.user.login}
                                </span>
                                {pr.data?.created_at && (
                                    <>
                                        {' '}
                                        opened{' '}
                                        <span className="font-medium">
                                            {formatDistanceToNow(new Date(pr.data.created_at), {
                                                addSuffix: true,
                                            })}
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>
                        <MergeInfo pr={pr.data} />
                        <span className="text-sm text-muted-foreground">
                            <span className="text-green-600">+{pr.data?.additions}</span>{' '}
                            <span className="text-red-600">-{pr.data?.deletions}</span>
                        </span>
                    </div>

                    {/* Labels and Milestone */}
                    {(pr.data?.labels && pr.data.labels.length > 0) || pr.data?.milestone ? (
                        <div className="mb-4 flex gap-3 flex-wrap items-center">
                            {pr.data.labels.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {pr.data.labels.map((label) => (
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
                            {pr.data.milestone && (
                                <span className="text-xs px-2 py-1 rounded border border-border">
                                    📍 {pr.data.milestone.title}
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
                                        : 'text-muted-foreground hover:text-foreground'
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
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Files{pr.data?.changedFiles ? ` (${pr.data.changedFiles})` : ''}
                            </PrefetchLink>
                        </div>
                    </div>

                    {props.children}
                </>
            )}
        </PageContainer>
    )
}

function MergeInfo(props: { pr?: PR }) {
    let baseRepo = props.pr?.base.repo
    let headRepo = props.pr?.head.repo

    let baseLabel = baseRepo ? `${baseRepo.owner.login}:${props.pr?.base.ref}` : 'unknown'
    let headLabel = headRepo ? `${headRepo.owner.login}:${props.pr?.head.ref}` : 'unknown'

    return (
        <span className="text-muted-foreground">
            wants to merge {props.pr?.changedFiles} commits into{' '}
            {baseRepo ? (
                <PrefetchLink
                    to="/$owner/$repo"
                    params={{ owner: baseRepo.owner.login, repo: baseRepo.name }}
                    className="text-blue-500 hover:underline"
                >
                    {baseLabel}
                </PrefetchLink>
            ) : (
                baseLabel
            )}{' '}
            from{' '}
            {headRepo ? (
                <PrefetchLink
                    to="/$owner/$repo"
                    params={{ owner: headRepo.owner.login, repo: headRepo.name }}
                    className="text-blue-500 hover:underline"
                >
                    {headLabel}
                </PrefetchLink>
            ) : (
                headLabel
            )}
        </span>
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
