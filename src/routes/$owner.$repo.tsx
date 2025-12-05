import { RepoNavLink } from '@/components/repo-nav-link'
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

    const isActive = (path: string) => location.pathname.includes(path)

    return (
        <div className="min-h-screen flex flex-col font-sans">
            {/* Header */}
            <div className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-40">
                {/* Title row */}
                <div className="px-8 py-4 flex items-center justify-between">
                    <div>
                        <span className="text-zinc-600">{params.owner}</span>
                        <span className="text-zinc-400 mx-2">/</span>
                        <span>{params.repo}</span>
                    </div>
                    <UserMenu />
                </div>

                {/* Nav tabs row */}
                <div className="px-4 flex items-center gap-6">
                    <RepoNavLink
                        to="/$owner/$repo/code"
                        params={params}
                        icon={<CodeIcon size={16} />}
                        label="Code"
                        isActive={isActive('code')}
                    />

                    <RepoNavLink
                        to="/$owner/$repo/issues"
                        params={params}
                        icon={<IssueOpenedIcon size={16} />}
                        label="Issues"
                        isActive={isActive('issues')}
                        badge={
                            <span className="ml-1 text-xs bg-zinc-200 px-2 py-0.5 rounded-full tabular-nums min-w-5 inline-block text-center">
                                {stats?.openIssues ?? ''}
                            </span>
                        }
                    />

                    <RepoNavLink
                        to="/$owner/$repo/pulls"
                        params={params}
                        icon={<GitPullRequestIcon size={16} />}
                        label="Pull requests"
                        isActive={isActive('pulls')}
                        badge={
                            <span className="ml-1 text-xs bg-zinc-300 text-zinc-700 px-2 py-0.5 rounded-full tabular-nums min-w-5 inline-block text-center">
                                {stats?.openPullRequests ?? ''}
                            </span>
                        }
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    )
}
