import { PrefetchLink } from '@/components/prefetch-link'
import { UserMenu } from '@/components/user-menu'
import { qcopts } from '@/query-client'
import { CodeIcon, GitPullRequestIcon, IssueOpenedIcon } from '@primer/octicons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useLocation, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo')({
    component: RepoLayout,
})

function RepoLayout() {
    const params = useParams({ strict: false }) as {
        owner: string
        repo: string
    }
    const location = useLocation()

    const { data: stats } = useQuery(qcopts.getRepositoryStats(params.owner, params.repo))

    const getTabClass = (path: string) => {
        const isActive = location.pathname.includes(path)
        return {
            border: isActive ? 'border-b-2 border-orange-500' : 'border-b-2 border-transparent',
            text: isActive ? 'font-bold' : '',
        }
    }

    return (
        <div className="min-h-screen flex flex-col font-sans">
            {/* Header */}
            <div className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-40">
                {/* Title row */}
                <div className="px-8 py-2 flex items-center justify-between">
                    <div>
                        <span className="text-zinc-600">{params.owner}</span>
                        <span className="text-zinc-400 mx-2">/</span>
                        <span>{params.repo}</span>
                    </div>
                    <UserMenu />
                </div>

                {/* Nav tabs row */}
                <div className="px-8 flex items-center gap-6 text-zinc-900">
                    {/* Code */}
                    <div
                        className={`flex flex-col justify-center h-12 ${getTabClass('code').border}`}
                    >
                        <PrefetchLink
                            to="/$owner/$repo/code"
                            params={params}
                            className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-200 transition-colors ${getTabClass('code').text}`}
                        >
                            <CodeIcon size={16} />
                            <span className="text-sm">Code</span>
                        </PrefetchLink>
                    </div>

                    {/* Issues */}
                    <div
                        className={`flex flex-col justify-center h-12 ${getTabClass('issues').border}`}
                    >
                        <PrefetchLink
                            to="/$owner/$repo/issues"
                            params={params}
                            className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-200 transition-colors ${getTabClass('issues').text}`}
                        >
                            <IssueOpenedIcon size={16} />
                            <span className="text-sm">Issues</span>
                            {stats && (
                                <span className="ml-1 text-xs bg-zinc-300 text-zinc-700 px-2 py-0.5 rounded-full">
                                    {stats.openIssues}
                                </span>
                            )}
                        </PrefetchLink>
                    </div>

                    {/* Pull requests */}
                    <div
                        className={`flex flex-col justify-center h-12 ${getTabClass('pulls').border}`}
                    >
                        <PrefetchLink
                            to="/$owner/$repo/pulls"
                            params={params}
                            className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-200 transition-colors ${getTabClass('pulls').text}`}
                        >
                            <GitPullRequestIcon size={16} />
                            <span className="text-sm">Pull requests</span>
                            {stats && (
                                <span className="ml-1 text-xs bg-zinc-300 text-zinc-700 px-2 py-0.5 rounded-full">
                                    {stats.openPullRequests}
                                </span>
                            )}
                        </PrefetchLink>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    )
}
