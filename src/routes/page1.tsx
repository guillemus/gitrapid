import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { createFileRoute } from '@tanstack/react-router'
import {
    AlertCircle,
    Archive,
    Bell,
    Check,
    CheckCircle2,
    MessageSquare,
    Pin,
    Search,
    Star,
} from 'lucide-react'
import { useMemo, useState } from 'react'

export const Route = createFileRoute('/page1')({
    component: RouteComponent,
})

type NotificationType = 'mention' | 'comment' | 'review' | 'assign' | 'alert'
type NotificationTab = 'all' | 'saved' | 'done'

interface Notification {
    id: string
    repo: string
    owner: string
    title: string
    type: NotificationType
    read: boolean
    saved: boolean
    pinned: boolean
    done: boolean
    createdAt: Date
}

function getMockNotifications(): Notification[] {
    let notifications: Notification[] = [
        {
            id: '1',
            repo: 'gitrapid',
            owner: 'guillem',
            title: 'Fix: Improve performance of notifications filter',
            type: 'mention',
            read: false,
            saved: false,
            pinned: false,
            done: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 5),
        },
        {
            id: '2',
            repo: 'react-query',
            owner: 'tannerlinsley',
            title: 'Bump version to 5.0.0',
            type: 'review',
            read: true,
            saved: true,
            pinned: true,
            done: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 15),
        },
        {
            id: '3',
            repo: 'shadcn-ui',
            owner: 'shadcn',
            title: 'Add new Button component variants',
            type: 'comment',
            read: false,
            saved: false,
            pinned: false,
            done: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
            id: '4',
            repo: 'gitrapid',
            owner: 'guillem',
            title: 'Assign you to: Implement webhook sync',
            type: 'assign',
            read: true,
            saved: false,
            pinned: false,
            done: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 60),
        },
        {
            id: '5',
            repo: 'convex-backend',
            owner: 'guillem',
            title: 'Security Alert: Dependency vulnerability detected',
            type: 'alert',
            read: false,
            saved: true,
            pinned: false,
            done: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 120),
        },
        {
            id: '6',
            repo: 'gitrapid',
            owner: 'guillem',
            title: 'Review: Refactor database schema',
            type: 'review',
            read: true,
            saved: false,
            pinned: false,
            done: true,
            createdAt: new Date(Date.now() - 1000 * 60 * 240),
        },
    ]

    return notifications
}

function getTypeIcon(type: NotificationType): React.ReactNode {
    switch (type) {
        case 'mention':
            return <MessageSquare className="h-4 w-4 text-blue-500" />
        case 'comment':
            return <MessageSquare className="h-4 w-4 text-gray-500" />
        case 'review':
            return <CheckCircle2 className="h-4 w-4 text-green-500" />
        case 'assign':
            return <AlertCircle className="h-4 w-4 text-orange-500" />
        case 'alert':
            return <AlertCircle className="h-4 w-4 text-red-500" />
        default:
            return <Bell className="h-4 w-4 text-gray-500" />
    }
}

function getTypeLabel(type: NotificationType): string {
    switch (type) {
        case 'mention':
            return 'Mention'
        case 'comment':
            return 'Comment'
        case 'review':
            return 'Review'
        case 'assign':
            return 'Assigned'
        case 'alert':
            return 'Alert'
        default:
            return 'Notification'
    }
}

function formatTimeAgo(date: Date): string {
    let seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    let interval = seconds / 31536000
    if (interval > 1) {
        return Math.floor(interval) + 'y'
    }
    interval = seconds / 2592000
    if (interval > 1) {
        return Math.floor(interval) + 'mo'
    }
    interval = seconds / 86400
    if (interval > 1) {
        return Math.floor(interval) + 'd'
    }
    interval = seconds / 3600
    if (interval > 1) {
        return Math.floor(interval) + 'h'
    }
    interval = seconds / 60
    if (interval > 1) {
        return Math.floor(interval) + 'm'
    }
    return Math.floor(seconds) + 's'
}

function NotificationRow({
    notification,
    isSelected,
    onToggleSelect,
    onMarkRead,
    onSave,
    onPin,
    onDone,
}: {
    notification: Notification
    isSelected: boolean
    onToggleSelect: () => void
    onMarkRead: () => void
    onSave: () => void
    onPin: () => void
    onDone: () => void
}): React.ReactElement {
    return (
        <div
            className={`border-b px-4 py-2 transition-colors hover:bg-gray-50 ${
                !notification.read ? 'bg-blue-50' : ''
            }`}
        >
            <div className="flex items-start gap-3">
                <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="mt-1" />

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {getTypeIcon(notification.type)}
                        <div className="min-w-0 flex-1">
                            <p
                                className={`truncate text-sm font-medium ${
                                    !notification.read ? 'text-gray-900' : 'text-gray-600'
                                }`}
                            >
                                {notification.title}
                            </p>
                        </div>
                    </div>

                    <div className="ml-6 flex items-center gap-2 text-xs text-gray-500">
                        <span className="inline-block rounded py-1 text-gray-700">
                            {notification.owner}/{notification.repo}
                        </span>
                    </div>
                </div>

                <div className="ml-2 grid w-80 grid-cols-8 items-center gap-2">
                    <div className="col-span-3 inline-flex h-8 items-center justify-center px-3 py-0 text-xs leading-none font-medium whitespace-nowrap">
                        {getTypeLabel(notification.type)}
                    </div>

                    <span className="inline-flex h-8 items-center justify-end text-xs leading-none whitespace-nowrap text-gray-400">
                        {formatTimeAgo(notification.createdAt)}
                    </span>

                    <div>
                        {!notification.read && (
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
                                    notification.saved
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
                                    notification.pinned
                                        ? 'fill-current text-gray-700'
                                        : 'text-gray-400'
                                }`}
                            />
                        </Button>
                    </div>

                    <div>
                        {!notification.done && (
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

function PinnedNotificationCard({
    notification,
    isSelected,
    onToggleSelect,
    onMarkRead,
    onSave,
    onPin,
    onDone,
}: {
    notification: Notification
    isSelected: boolean
    onToggleSelect: () => void
    onMarkRead: () => void
    onSave: () => void
    onPin: () => void
    onDone: () => void
}): React.ReactElement {
    return (
        <div className="inline-block w-1/3 p-2">
            <div
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-gray-50 ${
                    !notification.read ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                        {getTypeIcon(notification.type)}
                        <div className="min-w-0 flex-1">
                            <p
                                className={`truncate text-sm font-medium ${
                                    !notification.read ? 'text-gray-900' : 'text-gray-600'
                                }`}
                            >
                                {notification.title}
                            </p>
                            <div className="mt-0.5 text-xs text-gray-500">
                                {notification.owner}/{notification.repo}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                    {!notification.read && (
                        <Button variant="ghost" size="sm" className="h-6" onClick={onMarkRead}>
                            <Check className="h-3 w-3 text-gray-400" />
                        </Button>
                    )}

                    <Button variant="ghost" size="sm" className="h-6" onClick={onSave}>
                        <Star
                            className={`h-3 w-3 ${
                                notification.saved
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-400'
                            }`}
                        />
                    </Button>

                    <Button variant="ghost" size="sm" className="h-6" onClick={onPin}>
                        <Pin
                            className={`h-3 w-3 ${
                                notification.pinned ? 'fill-current text-gray-700' : 'text-gray-400'
                            }`}
                        />
                    </Button>

                    {!notification.done && (
                        <Button variant="ghost" size="sm" className="h-6" onClick={onDone}>
                            <Archive className="h-3 w-3 text-gray-400" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

function RouteComponent(): React.ReactElement {
    let [notifications, setNotifications] = useState<Notification[]>(getMockNotifications())
    let [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    let [activeTab, setActiveTab] = useState<NotificationTab>('all')
    let [searchQuery, setSearchQuery] = useState('')
    let [filterRepo, setFilterRepo] = useState<string | null>(null)
    let [showUnreadOnly, setShowUnreadOnly] = useState(false)

    // Get unique repositories for filter sidebar
    let repositories = useMemo(
        function getRepositories(): string[] {
            let repoSet = new Set(notifications.map((n) => n.repo))
            return Array.from(repoSet).sort()
        },
        [notifications],
    )

    // Filter and sort notifications
    let filteredNotifications = useMemo(
        function filterNotifications(): Notification[] {
            let filtered = notifications.filter(function filterByTab(n) {
                if (activeTab === 'done') {
                    return n.done
                } else if (activeTab === 'saved') {
                    return n.saved && !n.done
                } else {
                    return !n.done
                }
            })

            filtered = filtered.filter(function filterByRepo(n) {
                if (filterRepo === null) return true
                return n.repo === filterRepo
            })

            filtered = filtered.filter(function filterByRead(n) {
                if (!showUnreadOnly) return true
                return !n.read
            })

            filtered = filtered.filter(function filterBySearch(n) {
                if (!searchQuery) return true
                return n.title.toLowerCase().includes(searchQuery.toLowerCase())
            })

            // Sort: pinned first, then by creation time descending
            filtered.sort(function sortNotifications(a, b) {
                if (a.pinned === b.pinned) {
                    return b.createdAt.getTime() - a.createdAt.getTime()
                }
                return a.pinned ? -1 : 1
            })

            return filtered
        },
        [notifications, activeTab, filterRepo, showUnreadOnly, searchQuery],
    )

    // Calculate stats
    let stats = useMemo(
        function calculateStats() {
            let unreadCount = notifications.filter((n) => !n.read && !n.done).length
            let savedCount = notifications.filter((n) => n.saved && !n.done).length
            let doneCount = notifications.filter((n) => n.done).length
            return { unreadCount, savedCount, doneCount }
        },
        [notifications],
    )

    // Check if any selected notifications are unread
    let hasUnreadSelected = useMemo(
        function hasUnreadInSelection(): boolean {
            for (let id of selectedIds) {
                let notification = notifications.find((n) => n.id === id)
                if (notification && !notification.read) {
                    return true
                }
            }
            return false
        },
        [selectedIds, notifications],
    )

    function toggleSelectNotification(id: string): void {
        let newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    function toggleSelectAll(): void {
        if (selectedIds.size === filteredNotifications.length) {
            setSelectedIds(new Set())
        } else {
            let allIds = new Set(filteredNotifications.map((n) => n.id))
            setSelectedIds(allIds)
        }
    }

    function markAllAsRead(): void {
        let updated = notifications.map(function markIfSelected(n) {
            if (selectedIds.has(n.id)) {
                return { ...n, read: true }
            }
            return n
        })
        setNotifications(updated)
        setSelectedIds(new Set())
    }

    function updateNotification(id: string, updates: Partial<Notification>): void {
        let updated = notifications.map(function applyUpdate(n) {
            if (n.id === id) {
                return { ...n, ...updates }
            }
            return n
        })
        setNotifications(updated)
    }

    function handleMarkRead(id: string): void {
        updateNotification(id, { read: true })
    }

    function handleSave(id: string): void {
        let notification = notifications.find((n) => n.id === id)
        if (notification) {
            updateNotification(id, { saved: !notification.saved })
        }
    }

    function handlePin(id: string): void {
        let notification = notifications.find((n) => n.id === id)
        if (notification) {
            updateNotification(id, { pinned: !notification.pinned })
        }
    }

    function handleDone(id: string): void {
        let notification = notifications.find((n) => n.id === id)
        if (notification) {
            updateNotification(id, { done: !notification.done })
            // Auto-switch to done tab if marking as done
            if (!notification.done && activeTab === 'all') {
                // Keep on current tab
            }
        }
    }

    let totalNotifications = filteredNotifications.length
    let pinnedNotifications = filteredNotifications.filter((n) => n.pinned)
    let unpinnedNotifications = filteredNotifications.filter((n) => !n.pinned)

    return (
        <div className="flex h-screen bg-white">
            {/* Left Sidebar */}
            <div className="flex w-64 flex-col border-r border-gray-200 bg-gray-50">
                {/* Header */}
                <div className="border-b border-gray-200 px-4 py-4">
                    <div className="mb-4 flex items-center gap-2">
                        <Bell className="h-5 w-5 text-gray-700" />
                        <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
                    </div>
                </div>

                {/* Tabs */}
                <div className="space-y-2 border-b border-gray-200 px-4 py-3">
                    <button
                        onClick={() => {
                            setActiveTab('all')
                            setFilterRepo(null)
                        }}
                        className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                            activeTab === 'all'
                                ? 'bg-blue-100 font-medium text-blue-900'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span>All Notifications</span>
                            <span className="rounded bg-gray-200 px-2 py-1 text-xs">
                                {stats.unreadCount}
                            </span>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('saved')}
                        className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                            activeTab === 'saved'
                                ? 'bg-blue-100 font-medium text-blue-900'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span>Saved</span>
                            <span className="rounded bg-gray-200 px-2 py-1 text-xs">
                                {stats.savedCount}
                            </span>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('done')}
                        className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                            activeTab === 'done'
                                ? 'bg-blue-100 font-medium text-blue-900'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span>Done</span>
                            <span className="rounded bg-gray-200 px-2 py-1 text-xs">
                                {stats.doneCount}
                            </span>
                        </div>
                    </button>
                </div>

                {/* Filters */}
                <div className="border-b border-gray-200 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                        Repositories
                    </p>
                    <div className="space-y-1">
                        <button
                            onClick={() => setFilterRepo(null)}
                            className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                                filterRepo === null
                                    ? 'bg-blue-100 font-medium text-blue-900'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            All Repositories
                        </button>
                        {repositories.map(function renderRepo(repo) {
                            return (
                                <button
                                    key={repo}
                                    onClick={() => setFilterRepo(repo)}
                                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                                        filterRepo === repo
                                            ? 'bg-blue-100 font-medium text-blue-900'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    {repo}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Read Status Filter */}
                <div className="border-b border-gray-200 px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                            checked={showUnreadOnly}
                            onCheckedChange={(checked) => setShowUnreadOnly(checked === true)}
                        />
                        <span className="text-sm text-gray-700">Unread only</span>
                    </label>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 flex-col">
                {/* Toolbar */}
                <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4">
                    <div className="text-sm text-gray-600">
                        {totalNotifications === 0
                            ? 'No notifications'
                            : `${totalNotifications} notification${totalNotifications === 1 ? '' : 's'}`}
                    </div>
                    {selectedIds.size > 0 && (
                        <div className="text-sm text-gray-600">{selectedIds.size} selected</div>
                    )}
                    <div className="relative flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Search notifications..."
                            className="pl-9 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.currentTarget.value)}
                        />
                    </div>
                </div>

                {/* Notifications Feed */}
                <div className="flex-1 overflow-y-auto">
                    {totalNotifications === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <Bell className="mb-4 h-12 w-12 text-gray-300" />
                            <h3 className="mb-2 text-lg font-semibold text-gray-600">
                                {activeTab === 'done'
                                    ? 'No done notifications'
                                    : activeTab === 'saved'
                                      ? 'No saved notifications'
                                      : 'All caught up!'}
                            </h3>
                            <p className="max-w-xs text-sm text-gray-500">
                                {activeTab === 'done'
                                    ? "You haven't marked anything as done yet."
                                    : activeTab === 'saved'
                                      ? 'Save notifications for later using the star icon.'
                                      : 'You have no new notifications. Great job!'}
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* Pinned Section */}
                            {pinnedNotifications.length > 0 && (
                                <>
                                    <div className="sticky top-0 z-10 border-b border-gray-200 bg-yellow-50 px-4 py-2">
                                        <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                                            📌 Pinned ({pinnedNotifications.length})
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap px-2 py-2">
                                        {pinnedNotifications.map((notification) => (
                                            <PinnedNotificationCard
                                                key={notification.id}
                                                notification={notification}
                                                isSelected={selectedIds.has(notification.id)}
                                                onToggleSelect={() =>
                                                    toggleSelectNotification(notification.id)
                                                }
                                                onMarkRead={() => handleMarkRead(notification.id)}
                                                onSave={() => handleSave(notification.id)}
                                                onPin={() => handlePin(notification.id)}
                                                onDone={() => handleDone(notification.id)}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Unpinned Section */}
                            {unpinnedNotifications.length > 0 && (
                                <>
                                    {pinnedNotifications.length > 0 && (
                                        <div className="sticky top-12 z-10 border-b border-gray-200 bg-gray-100 px-4 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={unpinnedNotifications.every((n) =>
                                                            selectedIds.has(n.id),
                                                        )}
                                                        onCheckedChange={() => {
                                                            let newSelected = new Set(selectedIds)
                                                            const allUnpinnedSelected =
                                                                unpinnedNotifications.every((n) =>
                                                                    selectedIds.has(n.id),
                                                                )
                                                            if (allUnpinnedSelected) {
                                                                // Deselect all unpinned
                                                                unpinnedNotifications.forEach(
                                                                    (n) => {
                                                                        newSelected.delete(n.id)
                                                                    },
                                                                )
                                                            } else {
                                                                // Select all unpinned
                                                                unpinnedNotifications.forEach(
                                                                    (n) => {
                                                                        newSelected.add(n.id)
                                                                    },
                                                                )
                                                            }
                                                            setSelectedIds(newSelected)
                                                        }}
                                                    />
                                                    <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                                                        Other ({unpinnedNotifications.length})
                                                    </p>
                                                </div>
                                                {unpinnedNotifications.every((n) =>
                                                    selectedIds.has(n.id),
                                                ) && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2"
                                                            onClick={() => {
                                                                let updated = notifications.map(
                                                                    function markIfSelected(n) {
                                                                        if (selectedIds.has(n.id)) {
                                                                            return {
                                                                                ...n,
                                                                                read: true,
                                                                            }
                                                                        }
                                                                        return n
                                                                    },
                                                                )
                                                                setNotifications(updated)
                                                            }}
                                                        >
                                                            <Check className="h-4 w-4 text-gray-400" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2"
                                                            onClick={() => {
                                                                let updated = notifications.map(
                                                                    function markIfSelected(n) {
                                                                        if (selectedIds.has(n.id)) {
                                                                            return {
                                                                                ...n,
                                                                                done: !n.done,
                                                                            }
                                                                        }
                                                                        return n
                                                                    },
                                                                )
                                                                setNotifications(updated)
                                                            }}
                                                        >
                                                            <Archive className="h-4 w-4 text-gray-400" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {!pinnedNotifications.length && (
                                        <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 px-4 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={unpinnedNotifications.every((n) =>
                                                            selectedIds.has(n.id),
                                                        )}
                                                        onCheckedChange={() => {
                                                            let newSelected = new Set(selectedIds)
                                                            const allUnpinnedSelected =
                                                                unpinnedNotifications.every((n) =>
                                                                    selectedIds.has(n.id),
                                                                )
                                                            if (allUnpinnedSelected) {
                                                                // Deselect all unpinned
                                                                unpinnedNotifications.forEach(
                                                                    (n) => {
                                                                        newSelected.delete(n.id)
                                                                    },
                                                                )
                                                            } else {
                                                                // Select all unpinned
                                                                unpinnedNotifications.forEach(
                                                                    (n) => {
                                                                        newSelected.add(n.id)
                                                                    },
                                                                )
                                                            }
                                                            setSelectedIds(newSelected)
                                                        }}
                                                    />
                                                    <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                                                        Other ({unpinnedNotifications.length})
                                                    </p>
                                                </div>
                                                {unpinnedNotifications.every((n) =>
                                                    selectedIds.has(n.id),
                                                ) && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2"
                                                            onClick={() => {
                                                                let updated = notifications.map(
                                                                    function markIfSelected(n) {
                                                                        if (selectedIds.has(n.id)) {
                                                                            return {
                                                                                ...n,
                                                                                read: true,
                                                                            }
                                                                        }
                                                                        return n
                                                                    },
                                                                )
                                                                setNotifications(updated)
                                                            }}
                                                        >
                                                            <Check className="h-4 w-4 text-gray-400" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2"
                                                            onClick={() => {
                                                                let updated = notifications.map(
                                                                    function markIfSelected(n) {
                                                                        if (selectedIds.has(n.id)) {
                                                                            return {
                                                                                ...n,
                                                                                done: !n.done,
                                                                            }
                                                                        }
                                                                        return n
                                                                    },
                                                                )
                                                                setNotifications(updated)
                                                            }}
                                                        >
                                                            <Archive className="h-4 w-4 text-gray-400" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {unpinnedNotifications.map(
                                        function renderUnpinned(notification) {
                                            return (
                                                <NotificationRow
                                                    key={notification.id}
                                                    notification={notification}
                                                    isSelected={selectedIds.has(notification.id)}
                                                    onToggleSelect={() =>
                                                        toggleSelectNotification(notification.id)
                                                    }
                                                    onMarkRead={() =>
                                                        handleMarkRead(notification.id)
                                                    }
                                                    onSave={() => handleSave(notification.id)}
                                                    onPin={() => handlePin(notification.id)}
                                                    onDone={() => handleDone(notification.id)}
                                                />
                                            )
                                        },
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Selection Bar - Hidden */}
            </div>
        </div>
    )
}
