import { qc } from '@/lib'
import { CodeIcon, GitPullRequestIcon, IssueOpenedIcon } from '@primer/octicons-react'
import { useQuery } from '@tanstack/react-query'
import { useMatch } from '@tanstack/react-router'
import { GithubLink } from './github-link'
import { PrefetchLink } from './prefetch-link'
import { RepoNavLink } from './repo-nav-link'
import { UserMenu } from './user-menu'

function Logo() {
    return (
        <PrefetchLink to="/dashboard">
            <img src="/favicon.png" alt="gitrapid" className="w-6 h-6 rounded" />
        </PrefetchLink>
    )
}

export function HeaderDashboard() {
    return (
        <div className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-40">
            <div className="px-8 py-4 flex items-center gap-3">
                <Logo />
                <span className="font-semibold text-zinc-900">Dashboard</span>
                <div className="flex-1" />
                <UserMenu />
            </div>
        </div>
    )
}

export function HeaderOwner(props: { owner: string }) {
    return (
        <div className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-40">
            <div className="px-8 py-4 flex items-center gap-3">
                <Logo></Logo>
                <span className="font-semibold text-zinc-900">{props.owner}</span>
                <div className="flex-1" />
                <UserMenu />
            </div>
        </div>
    )
}

export function HeaderRepo(props: { owner: string; repo: string }) {
    const { data: stats } = useQuery(qc.getRepositoryStats(props.owner, props.repo))

    let isCode = useMatch({ from: '/$owner/$repo/', shouldThrow: false })
    let isIssues = useMatch({ from: '/$owner/$repo/issues', shouldThrow: false })
    let isPulls = useMatch({ from: '/$owner/$repo/pulls', shouldThrow: false })
    let isPullDetail = useMatch({ from: '/$owner/$repo/pull/$number', shouldThrow: false })

    let active = {
        code: !!isCode,
        issues: !!isIssues,
        prs: !!isPulls || !!isPullDetail,
    }

    return (
        <div className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-40">
            <div className="px-8 py-4 flex items-center gap-3">
                <Logo />

                <div>
                    <PrefetchLink
                        to="/$owner"
                        params={{ owner: props.owner }}
                        className="text-zinc-600 hover:text-zinc-900 hover:underline transition-colors"
                    >
                        {props.owner}
                    </PrefetchLink>
                    <span className="text-zinc-400 mx-2">/</span>
                    <span>{props.repo}</span>
                </div>

                <div className="flex-1" />

                <UserMenu />
            </div>

            {/* Nav tabs row */}
            <div className="px-4 flex items-center gap-2">
                <RepoNavLink
                    to="/$owner/$repo"
                    params={props}
                    icon={<CodeIcon size={16} />}
                    label="Code"
                    isActive={active.code}
                />

                <RepoNavLink
                    to="/$owner/$repo/issues"
                    params={props}
                    icon={<IssueOpenedIcon size={16} />}
                    label="Issues"
                    isActive={active.issues}
                    badge={
                        <span className="ml-1 text-xs bg-zinc-200 px-2 py-0.5 rounded-full tabular-nums min-w-5 inline-block text-center">
                            {stats?.openIssues ?? ''}
                        </span>
                    }
                />

                <RepoNavLink
                    to="/$owner/$repo"
                    params={props}
                    icon={<GitPullRequestIcon size={16} />}
                    label="Pull requests"
                    isActive={active.prs}
                    badge={
                        <span className="ml-1 text-xs bg-zinc-300 text-zinc-700 px-2 py-0.5 rounded-full tabular-nums min-w-5 inline-block text-center">
                            {stats?.openPullRequests ?? ''}
                        </span>
                    }
                />
                <div className="ml-auto">
                    <GithubLink />
                </div>
            </div>
        </div>
    )
}
