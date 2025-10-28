import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { usePaginationState, useTanstackQuery, type PaginationState } from '@/lib/utils'
import { api } from '@convex/_generated/api'
import { assertNever } from '@convex/shared'
import { useHookstate } from '@hookstate/core'
import { GitCommitIcon, GitPullRequestIcon, IssueOpenedIcon, TagIcon } from '@primer/octicons-react'
import { createFileRoute, Link, useNavigate, type LinkProps } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { formatDistanceToNow } from 'date-fns'
import { Archive, Bell, Check, Pin, Search, Star } from 'lucide-react'
import { createContext, use } from 'react'
import z from 'zod'

const searchSchema = z.object({
    repo: z.string().optional(),
    tab: z.enum(['saved', 'done', 'unread']).optional(),
    q: z.string().optional(),
})

export const Route = createFileRoute('/_app/notifications')({
    validateSearch: searchSchema,
    component: RouteComponent,
})

let PageContext = createContext<PaginationState>(null!)

function RouteComponent() {
    let pageState = usePaginationState()
    return (
        <PageContext.Provider value={pageState}>
            <div className="flex">
                <Sidebar></Sidebar>
                <Notifications></Notifications>
            </div>
        </PageContext.Provider>
    )
}

function usePage() {
    let search = Route.useSearch()
    let pagState = use(PageContext)
    let notifications = useTanstackQuery(api.public.notifications.list, {
        repo: search.repo,
        tab: search.tab,
        paginationOpts: {
            numItems: 25,
            cursor: pagState.currCursor(),
        },
    })

    return notifications
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
                            key={slug}
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

function Notifications() {
    let navigate = useNavigate()
    let page = usePage()

    async function onSearch(q: string) {
        await navigate({
            to: '/notifications',
            search: (s) => ({ ...s, q }),
        })
    }

    return (
        <div className="flex flex-1 flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4">
                <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        placeholder="Search notifications..."
                        className="pl-9 text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                let value = (e.target as HTMLInputElement).value
                                onSearch(value)
                            }
                        }}
                    />
                </div>
            </div>

            {/* Notifications Feed */}
            <div className="flex-1 overflow-y-auto">
                {page?.pinned.map((n) => (
                    <PinnedNotification key={n._id} notification={n} />
                ))}

                {page?.filtered.length === 0 && <NoNotificationsFound></NoNotificationsFound>}

                <FilteredHeader></FilteredHeader>

                {page?.filtered.map((n) => (
                    <FilteredNotification key={n._id} notification={n}></FilteredNotification>
                ))}
            </div>
        </div>
    )
}

function NoNotificationsFound() {
    return (
        <div className="flex h-full flex-col items-center justify-center text-center">
            <Bell className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-semibold text-gray-600">No notifications found</h3>
            <p className="max-w-xs text-sm text-gray-500">You have no new notifications.</p>
        </div>
    )
}

type ListQuery = FunctionReturnType<typeof api.public.notifications.list>

type PinnedNotification = ListQuery['pinned'][number]
type FilteredNotification = ListQuery['filtered'][number]

function getReasonLabel(reason: FilteredNotification['reason']): string {
    switch (reason) {
        case 'mention':
            return 'Mention'
        case 'comment':
            return 'Comment'
        case 'author':
            return 'Review'
        case 'assign':
            return 'Assigned'
        case 'approval_requested':
            return 'Alert'
        case 'review_requested':
            return 'Review Requested'
        case 'security_advisory_credit':
            return 'Security Advisory Credit'
        case 'security_alert':
            return 'Security Alert'
        case 'state_change':
            return 'State Change'
        case 'subscribed':
            return 'Subscribed'
        case 'ci_activity':
            return 'CI Activity'
        case 'member_feature_requested':
            return 'Member Feature Requested'
        case 'team_mention':
            return 'Team Mention'
        case 'invitation':
            return 'Invitation'
        case 'manual':
            return 'Manual'
    }
}

function FilteredHeader() {
    return (
        <div className="border-b border-gray-200 bg-gray-100 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Checkbox checked={false} onCheckedChange={() => {}} className="mt-1" />
                    <span className="text-sm font-semibold text-gray-700">Select all</span>
                </div>
            </div>
        </div>
    )
}

function FilteredNotification(props: { notification: FilteredNotification }) {
    function onMarkRead() {}
    function onSave() {}
    function onPin() {}
    function onDone() {}

    let isSelected = useHookstate(false)

    return (
        <div
            className={`border-b px-4 py-2 transition-colors hover:bg-gray-50 ${
                props.notification.unread ? 'bg-blue-50' : ''
            }`}
        >
            <div className="flex items-start gap-3">
                <Checkbox
                    checked={isSelected.get()}
                    onCheckedChange={() => isSelected.set((s) => !s)}
                    className="mt-1"
                />

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <NotificationIcon type={props.notification.type} />
                        <div className="min-w-0 flex-1">
                            <p
                                className={`truncate text-sm font-medium ${
                                    props.notification.unread ? 'text-gray-900' : 'text-gray-600'
                                }`}
                            >
                                {props.notification.title}
                            </p>
                        </div>
                    </div>

                    <div className="ml-6 flex items-center gap-2 text-xs text-gray-500">
                        <span className="inline-block rounded py-1 text-gray-700">
                            {props.notification.repo.owner}/{props.notification.repo.repo}
                        </span>
                    </div>
                </div>

                <div className="ml-2 grid w-100 grid-cols-9 items-center gap-2">
                    <div className="col-span-3 inline-flex h-8 items-center justify-center px-3 py-0 text-xs leading-none font-medium whitespace-nowrap">
                        {getReasonLabel(props.notification.reason)}
                    </div>

                    <span className="col-span-2 inline-flex h-8 items-center justify-end text-xs leading-none whitespace-nowrap text-gray-400">
                        {formatDistanceToNow(props.notification.updatedAt)}
                    </span>

                    <div>
                        {props.notification.unread && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={onMarkRead}
                            >
                                <Check className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div>
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onSave}>
                            <Star
                                className={`h-4 w-4 ${
                                    props.notification.saved
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-gray-400'
                                }`}
                            />
                        </Button>
                    </div>

                    <div>
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPin}>
                            <Pin
                                className={`h-4 w-4 ${
                                    props.notification.pinned
                                        ? 'fill-current text-gray-700'
                                        : 'text-gray-400'
                                }`}
                            />
                        </Button>
                    </div>

                    <div>
                        {!props.notification.done && (
                            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onDone}>
                                <Archive className="h-4 w-4 text-gray-400" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function PinnedNotification(props: { notification: PinnedNotification }): React.ReactElement {
    function onMarkRead() {}
    function onSave() {}
    function onPin() {}
    function onDone() {}

    return (
        <div className="inline-block w-1/3 p-2">
            <div
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-gray-50 ${
                    props.notification.unread
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 bg-white'
                }`}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                        <NotificationIcon type={props.notification.type} />
                        <div className="min-w-0 flex-1">
                            <p
                                className={`truncate text-sm font-medium ${
                                    props.notification.unread ? 'text-gray-900' : 'text-gray-600'
                                }`}
                            >
                                {props.notification.title}
                            </p>
                            <div className="mt-0.5 text-xs text-gray-500">
                                {props.notification.repo.owner}/{props.notification.repo.repo}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                    {props.notification.unread && (
                        <Button variant="ghost" size="sm" className="h-6" onClick={onMarkRead}>
                            <Check className="h-3 w-3 text-gray-400" />
                        </Button>
                    )}

                    <Button variant="ghost" size="sm" className="h-6" onClick={onSave}>
                        <Star
                            className={`h-3 w-3 ${
                                props.notification.saved
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-400'
                            }`}
                        />
                    </Button>

                    <Button variant="ghost" size="sm" className="h-6" onClick={onPin}>
                        <Pin
                            className={`h-3 w-3 ${
                                props.notification.pinned
                                    ? 'fill-current text-gray-700'
                                    : 'text-gray-400'
                            }`}
                        />
                    </Button>

                    {!props.notification.done && (
                        <Button variant="ghost" size="sm" className="h-6" onClick={onDone}>
                            <Archive className="h-3 w-3 text-gray-400" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

function NotificationIcon(props: { type: PinnedNotification['type'] }) {
    if (props.type === 'Commit') {
        return <GitCommitIcon size={16} className="text-gray-500" />
    } else if (props.type === 'PullRequest') {
        return <GitPullRequestIcon size={16} className="text-gray-500" />
    } else if (props.type === 'Issue') {
        return <IssueOpenedIcon size={16} className="text-gray-500" />
    } else if (props.type === 'Release') {
        return <TagIcon size={16} className="text-gray-500" />
    } else assertNever(props.type)
}
