import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { qcMem } from '@/lib/queryClient'
import { formatGitHubTime, objectEntries, usePagination, useTanstackQuery } from '@/lib/utils'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { assertNever } from '@convex/shared'
import {
    GitCommitIcon,
    GitPullRequestClosedIcon,
    GitPullRequestIcon,
    IssueClosedIcon,
    IssueOpenedIcon,
    TagIcon,
} from '@primer/octicons-react'
import { createFileRoute, Link, useNavigate, type LinkProps } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Bell, Bookmark, Check, Circle, CircleDot, Pin, Search, Undo } from 'lucide-react'
import z from 'zod'
import { create } from 'zustand'

let self = api.public.notifications

const searchSchema = z.object({
    repo: z.string().optional(),
    tab: z.enum(['saved', 'done', 'unread']).optional(),
    q: z.string().optional(),
})

export const Route = createFileRoute('/_app/notifications')({
    validateSearch: searchSchema,
    component: RouteComponent,
})

type ListQuery = FunctionReturnType<typeof self.list>
type ListPinnedQuery = FunctionReturnType<typeof self.listPinned>

type Notification = ListPinnedQuery[number]

type SelectedState = {
    selected: Record<Id<'notifications'>, boolean>
    allSelected: boolean

    setAllSelected(status: boolean): void
    check(id: Id<'notifications'>, checked: boolean): void
}

const useSelected = create<SelectedState>((set) => ({
    selected: {},
    allSelected: false,
    setAllSelected: (status) => set((state) => ({ ...state, allSelected: status })),
    check: (id, checked) => set((state) => ({ selected: { ...state.selected, [id]: checked } })),
}))

function useNotificationUpdates(notification: Notification) {
    let doUpdate = useMutation(self.updateNotification)
    let id = notification._id

    return {
        markAsRead: () => doUpdate({ id, updates: { unread: false } }),
        onSave: () => doUpdate({ id, updates: { saved: !notification.saved } }),
        onPin: () => doUpdate({ id, updates: { pinned: !notification.pinned } }),
        onDone: () => doUpdate({ id, updates: { done: !notification.done } }),
    }
}

function RouteComponent() {
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar></Sidebar>
            <Notifications></Notifications>
        </div>
    )
}

function useFiltered() {
    let search = Route.useSearch()
    let pageState = usePagination()
    let result = useTanstackQuery(
        self.list,
        {
            q: search.q,
            repo: search.repo,
            tab: search.tab,
            paginationOpts: {
                numItems: 25,
                cursor: pageState.currCursor(),
            },
        },
        qcMem,
    )

    return result
}

function Sidebar() {
    return (
        <div className="flex h-screen w-64 flex-col border-r border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-5">
                <Bell className="h-5 w-5 text-gray-700" />
                <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
            </div>

            <Tabs />

            <div className="border-b border-gray-200"></div>

            <Filters />
        </div>
    )
}

function Tabs() {
    let search = Route.useSearch()
    let isInbox = !search.tab

    return (
        <div className="space-y-1 px-2 py-3">
            <Navlink active={isInbox} to={'/notifications'}>
                Inbox
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
    let pageState = usePagination()

    return (
        <button
            className={`w-full rounded text-left text-sm font-medium transition-colors ${
                props.active
                    ? 'bg-blue-100 font-medium text-blue-900'
                    : 'text-gray-600 hover:text-gray-900'
            }`}
        >
            <Link
                to={props.to}
                search={props.search}
                onClick={() => {
                    pageState.resetCursors()
                }}
            >
                <span className="flex h-10 items-center px-3 py-2">{props.children}</span>
            </Link>
        </button>
    )
}

function Filters() {
    let search = Route.useSearch()
    let repositories
    repositories = useTanstackQuery(self.allRepos, {
        tab: search.tab,
    })
    if (repositories) {
        repositories = repositories.toSorted((a, b) => {
            let ownerCompare = a.owner.localeCompare(b.owner)
            if (ownerCompare !== 0) return ownerCompare
            return a.repo.localeCompare(b.repo)
        })
    }

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
                    let showBadge = repo.count > 0
                    let show50p = showBadge && repo.count > 50
                    let showCount = showBadge && repo.count <= 50

                    return (
                        <Navlink
                            key={slug}
                            active={search.repo === slug}
                            to={'/notifications'}
                            search={(s) => ({ ...s, repo: slug })}
                        >
                            <div className="flex w-full items-center justify-between">
                                <span>
                                    {repo.owner}/{repo.repo}
                                </span>
                                {showCount && <Badge variant="secondary">{repo.count}</Badge>}
                                {show50p && <Badge variant="secondary">50+</Badge>}
                            </div>
                        </Navlink>
                    )
                })}
            </div>
        </div>
    )
}

function NotificationsToolbar() {
    let navigate = useNavigate()
    let pageState = usePagination()

    async function onSearch(q: string) {
        pageState.resetCursors()
        await navigate({
            to: '/notifications',
            search: (s) => ({ ...s, q }),
        })
    }

    return (
        <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                    placeholder="Search notifications by title"
                    className="pl-9 text-sm"
                    onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                            let value = (e.target as HTMLInputElement).value
                            await onSearch(value)
                        }
                    }}
                />
            </div>
        </div>
    )
}

function FilteredNotifications() {
    let filtered = useFiltered()

    if (!filtered) return null

    if (filtered.page.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <NoNotificationsFound></NoNotificationsFound>
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <FilteredHeader
                paginationResult={filtered}
                visibleIds={filtered.page.map((n) => n._id)}
            ></FilteredHeader>
            <div className="flex-1 overflow-y-scroll">
                {filtered.page.map((n) => (
                    <FilteredNotification key={n._id} notification={n}></FilteredNotification>
                ))}
            </div>
        </div>
    )
}

function Notifications() {
    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <NotificationsToolbar></NotificationsToolbar>

            <PinnedNotifications></PinnedNotifications>

            <FilteredNotifications></FilteredNotifications>
        </div>
    )
}

function getReasonLabel(reason: Notification['reason']): string {
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

function FilteredHeader(props: { paginationResult: ListQuery; visibleIds: Id<'notifications'>[] }) {
    let pageState = usePagination()

    let selected = useSelected()

    let ids: Id<'notifications'>[] = []
    for (let [id, checked] of objectEntries(selected.selected)) {
        if (checked) ids.push(id)
    }

    let selectAllText = 'Select all'
    if (ids.length !== 0) {
        if (selected.allSelected) {
            selectAllText = `${ids.length}+ selected`
        } else {
            selectAllText = `${ids.length} selected`
        }
    }

    let selectAllChecked = !!ids.length

    function selectAll() {
        selected.setAllSelected(true)
        selectAllVisible(true)
    }
    function deselectAll() {
        selected.setAllSelected(false)
        selectAllVisible(false)
    }

    function selectAllVisible(status: boolean) {
        for (let id of props.visibleIds) {
            selected.check(id, status)
        }
    }

    function toggleSelectAll(checked: boolean) {
        if (checked) {
            selectAllVisible(true)
        } else {
            selectAllVisible(false)
            selected.setAllSelected(false)
        }
    }

    let selectTotalBtn = (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={selectAll}>
            <span> Select all notifications</span>
        </Button>
    )

    if (selected.allSelected) {
        selectTotalBtn = (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={deselectAll}>
                <span>{selected.allSelected ? 'Clear selection' : 'Select all notifications'}</span>
            </Button>
        )
    }

    let updateBatch = useMutation(self.updateBatch)

    async function markAsRead() {
        await updateBatch({
            all: selected.allSelected,
            selected: ids,
            updates: { unread: false },
        })
    }

    let markAsReadText = 'Mark as read'
    if (selected.allSelected) {
        markAsReadText = 'Mark all as read'
    }

    async function markAsUnread() {
        await updateBatch({
            all: selected.allSelected,
            selected: ids,
            updates: { unread: true },
        })
    }
    let markAsUnreadText = 'Mark as unread'
    if (selected.allSelected) {
        markAsUnreadText = 'Mark all as unread'
    }
    async function markAsDone() {
        await updateBatch({
            all: selected.allSelected,
            selected: ids,
            updates: { done: true },
        })
    }
    let markAsDoneText = 'Mark as done'
    if (selected.allSelected) {
        markAsDoneText = 'Mark all as done'
    }

    function goNext() {
        pageState.goToNext(props.paginationResult)
        deselectAll()
    }

    function goPrev() {
        pageState.goToPrev()
        deselectAll()
    }

    return (
        <div className="h-12 border-b border-gray-200 bg-gray-100 px-4 py-2">
            <div className="flex h-full items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                            checked={selectAllChecked}
                            onCheckedChange={toggleSelectAll}
                            className="mt-1"
                        />
                        <span className="text-sm font-semibold text-gray-700">{selectAllText}</span>
                    </label>

                    {ids.length > 0 && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={markAsDone}
                            >
                                <Check className="h-4 w-4" />
                                <span>{markAsDoneText}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={markAsRead}
                            >
                                <Circle className="!h-4 !w-4" />
                                <span>{markAsReadText}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={markAsUnread}
                            >
                                <CircleDot className="!h-4 !w-4" />
                                <span>{markAsUnreadText}</span>
                            </Button>

                            {selectTotalBtn}
                        </>
                    )}
                </div>
                {pageState.shouldShowPagination(props.paginationResult) && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!pageState.canGoPrev()}
                            onClick={goPrev}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!pageState.canGoNext(props.paginationResult)}
                            onClick={goNext}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

function SelectedCheckbox(props: { id: Id<'notifications'> }): React.ReactElement {
    let check = useSelected((x) => x.check)
    let isSelected = useSelected((x) => x.selected[props.id] ?? false)

    return (
        <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => check(props.id, !!checked)}
            className="mt-1"
        />
    )
}

function FilteredNotification(props: { notification: Notification }) {
    let updates = useNotificationUpdates(props.notification)
    let notifId = props.notification._id

    return (
        <div
            className={`border-b px-4 py-2 transition-colors hover:bg-gray-50 ${
                props.notification.unread ? 'bg-blue-50' : ''
            }`}
        >
            <div className="flex items-center gap-3">
                <SelectedCheckbox id={notifId} />

                {/* notification details */}
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

                {/* notification properties */}
                <div className="ml-2 grid w-100 grid-cols-8 items-center justify-center">
                    <div className="col-span-3 inline-flex h-8 items-center justify-center px-3 py-0 text-xs leading-none font-medium whitespace-nowrap">
                        {getReasonLabel(props.notification.reason)}
                    </div>

                    <span className="col-span-2 inline-flex h-8 items-center justify-end text-xs leading-none whitespace-nowrap text-gray-400">
                        {formatGitHubTime(props.notification.updatedAt)}
                    </span>

                    <div className="col-span-1"></div>

                    <div className="col-span-2 flex items-center justify-end">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    onClick={updates.onDone}
                                >
                                    {props.notification.done ? (
                                        <Undo className="h-4 w-4" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={-10}>
                                {props.notification.done ? 'Undo' : 'Mark as done'}
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={updates.onPin}
                                >
                                    <Pin
                                        className={`h-4 w-4 ${
                                            props.notification.pinned
                                                ? 'fill-current text-gray-700'
                                                : 'text-gray-400'
                                        }`}
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={-10}>Pin notification</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={updates.onSave}
                                >
                                    <Bookmark
                                        className={`h-4 w-4 ${
                                            props.notification.saved
                                                ? 'fill-current text-gray-700'
                                                : 'text-gray-400'
                                        }`}
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={-10}>Set as saved</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PinnedNotifications() {
    let pinned = useTanstackQuery(self.listPinned, {})
    let updateBatch = useMutation(self.updateBatch)

    if (!pinned || pinned.length === 0) return null

    async function clearPinned() {
        if (!pinned || pinned.length === 0) return

        let pinnedIds = pinned.map((n) => n._id)
        await updateBatch({
            all: false,
            selected: pinnedIds,
            updates: { pinned: false },
        })
    }

    return (
        <div>
            <div className="border-b border-gray-200 bg-yellow-50 px-4 py-2">
                <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold tracking-wide text-gray-600">
                        📌 Pinned ({pinned?.length ?? 0})
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={clearPinned}
                    >
                        Clear
                    </Button>
                </div>
            </div>

            <div className="p-2">
                {pinned.map((n) => (
                    <PinnedNotification key={n._id} notification={n} />
                ))}
            </div>
            <div className="border-b border-gray-200"></div>
        </div>
    )
}

function PinnedNotification(props: { notification: Notification }): React.ReactElement {
    let updates = useNotificationUpdates(props.notification)

    return (
        <div className="inline-block w-full p-2 lg:w-1/3">
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
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={updates.onDone}
                            >
                                {props.notification.done ? (
                                    <Undo className="h-3 w-3" />
                                ) : (
                                    <Check className="h-3 w-3" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={-10}>
                            {props.notification.done ? 'Undo' : 'Mark as done'}
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={updates.onPin}
                            >
                                <Pin
                                    className={`h-3 w-3 ${
                                        props.notification.pinned
                                            ? 'fill-current text-gray-700'
                                            : 'text-gray-400'
                                    }`}
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={-10}>Pin notification</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={updates.onSave}
                            >
                                <Bookmark
                                    className={`h-3 w-3 ${
                                        props.notification.saved
                                            ? 'fill-current text-gray-700'
                                            : 'text-gray-400'
                                    }`}
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={-10}>Set as saved</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    )
}

function NotificationIcon(props: { type: Notification['type'] }) {
    if (props.type.tag === 'commits') {
        return <GitCommitIcon size={16} className="text-gray-500" />
    }

    if (props.type.tag === 'prs') {
        if (props.type.state === 'open') {
            return <GitPullRequestIcon size={16} className="text-green-500" />
        }
        if (props.type.state === 'closed') {
            return <GitPullRequestClosedIcon size={16} className="text-red-500" />
        }
        if (props.type.state === 'merged') {
            return <GitPullRequestIcon size={16} className="text-purple-600" />
        }
        assertNever(props.type.state)
        return null
    }

    if (props.type.tag === 'issues') {
        if (props.type.state === 'closed') {
            return <IssueClosedIcon size={16} className="text-purple-600" />
        }
        if (props.type.state === 'open') {
            return <IssueOpenedIcon size={16} className="text-green-500" />
        }
        assertNever(props.type.state)
        return null
    }

    if (props.type.tag === 'releases') {
        return <TagIcon size={16} className="text-amber-500" />
    }
    assertNever(props.type)
}

type SearchParams = z.infer<typeof searchSchema>

function getEmptyStateMessage(search: SearchParams): { title: string; description: string } {
    const hasQuery = !!search.q
    const hasTab = !!search.tab
    const hasRepo = !!search.repo

    // All filters active
    if (hasQuery && hasTab && hasRepo) {
        return {
            title: 'No results found',
            description: `No ${search.tab} notifications matching "${search.q}" in ${search.repo}.`,
        }
    }

    // Query + Tab
    if (hasQuery && hasTab) {
        return {
            title: 'No results found',
            description: `No ${search.tab} notifications matching "${search.q}".`,
        }
    }

    // Query + Repo
    if (hasQuery && hasRepo) {
        return {
            title: 'No results found',
            description: `No notifications matching "${search.q}" in ${search.repo}.`,
        }
    }

    // Tab + Repo
    if (hasTab && hasRepo) {
        return {
            title: `No ${search.tab} notifications`,
            description: `You have no ${search.tab} notifications in ${search.repo}.`,
        }
    }

    // Query only
    if (hasQuery) {
        return {
            title: 'No results found',
            description: `No notifications matching "${search.q}". Try a different search term.`,
        }
    }

    // Tab only
    if (hasTab) {
        return {
            title: `No ${search.tab} notifications`,
            description: `You have no ${search.tab} notifications yet.`,
        }
    }

    // Repo only
    if (hasRepo) {
        return {
            title: 'No notifications',
            description: `You have no notifications from ${search.repo}.`,
        }
    }

    return { title: 'All caught up!', description: 'You have no notifications.' }
}

function NoNotificationsFound() {
    let search = Route.useSearch()
    let emptyMessage = getEmptyStateMessage(search)

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <Bell className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-semibold text-gray-600">{emptyMessage.title}</h3>
            <p className="max-w-xs text-sm text-gray-500">{emptyMessage.description}</p>
        </div>
    )
}
