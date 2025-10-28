import { usePaginationState, useTanstackQuery } from '@/lib/utils'
import { api } from '@convex/_generated/api'
import { createFileRoute, Link, type LinkProps } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { Bell } from 'lucide-react'
import z from 'zod'

const searchSchema = z.object({
    repo: z.string().optional(),
    tab: z.enum(['saved', 'done', 'unread']).optional(),
})

export const Route = createFileRoute('/_app/notifications')({
    validateSearch: searchSchema,
    component: RouteComponent,
})

type RepositoriesQuery = FunctionReturnType<typeof api.public.notifications.allRepos>

function RouteComponent() {
    let cursorState = usePaginationState()
    let search = Route.useSearch()
    let notifications = useTanstackQuery(api.public.notifications.list, {
        repo: search.repo,
        paginationOpts: {
            numItems: 25,
            cursor: cursorState.currCursor(),
        },
    })

    return (
        <div className="flex">
            <Sidebar />
        </div>
    )
}

function Sidebar() {
    return (
        <div className="flex h-screen w-64 flex-col border-r border-gray-200 bg-gray-50">
            <div className="border-b border-gray-200 px-4 py-4">
                <div className="mb-4 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-gray-700" />
                    <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
                </div>
            </div>

            <Tabs />

            <div className="border-b border-gray-200"></div>
            <Filters />
        </div>
    )
}

function Tabs() {
    let search = Route.useSearch()
    let isAll = !search.tab

    return (
        <div className="space-y-1 border-b border-gray-200 px-2 py-3">
            <Navlink active={isAll} to={'/notifications'}>
                All Notifications
            </Navlink>
            <Navlink
                active={search.tab === 'saved'}
                to={'/notifications'}
                search={(s) => ({ ...s, tab: 'saved' })}
            >
                Saved
            </Navlink>
            <Navlink
                active={search.tab === 'done'}
                to={'/notifications'}
                search={(s) => ({ ...s, tab: 'done' })}
            >
                Done
            </Navlink>
            <Navlink
                active={search.tab === 'unread'}
                to={'/notifications'}
                search={(s) => ({ ...s, tab: 'unread' })}
            >
                Unread
            </Navlink>
        </div>
    )
}

function Navlink(props: {
    children: React.ReactNode
    active: boolean
    to: LinkProps['to']
    search?: LinkProps['search']
}) {
    return (
        <button
            className={`w-full rounded text-left text-sm font-medium transition-colors ${
                props.active
                    ? 'bg-blue-100 font-medium text-blue-900'
                    : 'text-gray-600 hover:text-gray-900'
            }`}
        >
            <Link to={props.to} search={props.search}>
                <p className="px-3 py-2">{props.children}</p>
            </Link>
        </button>
    )
}
function Filters() {
    let search = Route.useSearch()
    let repositories = useTanstackQuery(api.public.notifications.allRepos, {})

    return (
        <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Repositories
            </p>
            <div className="space-y-1">
                <Navlink
                    active={!search.repo}
                    to={'/notifications'}
                    search={(s) => ({ ...s, repo: undefined })}
                >
                    All Repositories
                </Navlink>
                {repositories?.map(function renderRepo(repo) {
                    let slug = `${repo.owner}/${repo.repo}`
                    return (
                        <Navlink
                            active={search.repo === slug}
                            to={'/notifications'}
                            search={(s) => ({ ...s, repo: slug })}
                        >
                            {repo.owner}/{repo.repo}
                        </Navlink>
                    )
                })}
            </div>
        </div>
    )
}
