import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatRelativeTime, usePaginationState, useTanstackQuery } from '@/lib/utils'
import { api } from '@convex/_generated/api'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { AlertCircle, ChevronLeft, ChevronRight, GitPullRequest, Tag, Zap } from 'lucide-react'
import z from 'zod'

const searchSchema = z.object({
    ownerRepo: z.string().optional(),
})

export const Route = createFileRoute('/_app/notifications')({
    validateSearch: searchSchema,
    component: RouteComponent,
})

function RouteComponent() {
    return (
        <div className="flex">
            <div className="w-48">
                <Repositories></Repositories>
            </div>
            <div className="flex-1">
                <NotificationList></NotificationList>
            </div>
        </div>
    )
}

type RepositoriesQuery = FunctionReturnType<typeof api.public.notifications.allRepos>

function Repositories() {
    let repos = useTanstackQuery(api.public.notifications.allRepos, {})

    if (!repos || repos.length === 0) {
        return null
    }

    return (
        <div className="border-r border-gray-200 p-2">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-gray-700 uppercase">
                Repositories
            </h2>
            <div className="mt-2"></div>
            <div>
                {repos.map((repo) => (
                    <div key={repo._id}>
                        <RepositoryItem repo={repo} />
                    </div>
                ))}
            </div>
        </div>
    )
}

function RepositoryItem(props: { repo: RepositoriesQuery[number] }) {
    return (
        <div className="mb-1 flex items-center justify-between">
            <div className="min-w-0 flex-1">
                <Button
                    variant="ghost"
                    className="h-auto px-1 py-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                    asChild
                >
                    <Link
                        to="/notifications"
                        search={{ ownerRepo: `${props.repo.owner}/${props.repo.repo}` }}
                    >
                        {props.repo.owner}/{props.repo.repo}
                    </Link>
                </Button>
            </div>
        </div>
    )
}

type NotificationType = 'Issue' | 'PullRequest' | 'Commit' | 'Release'
type NotificationReason =
    | 'approval_requested'
    | 'assign'
    | 'author'
    | 'ci_activity'
    | 'comment'
    | 'invitation'
    | 'manual'
    | 'member_feature_requested'
    | 'mention'
    | 'review_requested'
    | 'security_advisory_credit'
    | 'security_alert'
    | 'state_change'
    | 'subscribed'
    | 'team_mention'

function getNotificationIcon(type: NotificationType) {
    switch (type) {
        case 'PullRequest':
            return <GitPullRequest className="h-4 w-4 text-red-400" />
        case 'Release':
            return <Tag className="h-4 w-4" />
        case 'Commit':
            return <Zap className="h-4 w-4" />
        case 'Issue':
        default:
            return <AlertCircle className="h-4 w-4 text-purple-600" />
    }
}

function getReasonBadgeColor(reason: NotificationReason) {
    const reasonMap: Record<NotificationReason, { bg: string; text: string }> = {
        approval_requested: { bg: 'bg-blue-100', text: 'text-blue-700' },
        assign: { bg: 'bg-purple-100', text: 'text-purple-700' },
        author: { bg: 'bg-green-100', text: 'text-green-700' },
        ci_activity: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
        comment: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
        invitation: { bg: 'bg-pink-100', text: 'text-pink-700' },
        manual: { bg: 'bg-gray-100', text: 'text-gray-700' },
        member_feature_requested: { bg: 'bg-orange-100', text: 'text-orange-700' },
        mention: { bg: 'bg-red-100', text: 'text-red-700' },
        review_requested: { bg: 'bg-blue-100', text: 'text-blue-700' },
        security_advisory_credit: { bg: 'bg-red-100', text: 'text-red-700' },
        security_alert: { bg: 'bg-red-100', text: 'text-red-700' },
        state_change: { bg: 'bg-green-100', text: 'text-green-700' },
        subscribed: { bg: 'bg-gray-100', text: 'text-gray-700' },
        team_mention: { bg: 'bg-purple-100', text: 'text-purple-700' },
    }
    return reasonMap[reason] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }
}

function formatReason(reason: NotificationReason) {
    return reason
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

function NotificationRow({
    notification,
}: {
    notification: {
        _id: string
        type: NotificationType
        reason: NotificationReason
        unread: boolean
        title: string
        resourceNumber: number
        repo: { owner: string; repo: string }
        updatedAt: string
    }
}) {
    let navigate = useNavigate()
    let reasonColors = getReasonBadgeColor(notification.reason)

    async function handleClick() {
        await navigate({
            to: '/$owner/$repo/issues/$issue',
            params: {
                owner: notification.repo.owner,
                repo: notification.repo.repo,
                issue: notification.resourceNumber,
            },
        })
    }

    return (
        <div
            className={cn(
                'cursor-pointer border-b border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50',
                notification.unread && 'bg-blue-50 hover:bg-blue-100',
            )}
            onClick={handleClick}
        >
            <div className="flex items-center gap-2">
                <div className="mt-0 flex-shrink-0 text-gray-400">
                    {getNotificationIcon(notification.type)}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                        <h3 className="truncate text-sm font-medium text-gray-900">
                            {notification.title}
                        </h3>
                        {notification.unread && (
                            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                        )}
                    </div>

                    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                        <span className="truncate text-xs text-gray-600">
                            {notification.repo.owner}/{notification.repo.repo} #
                            {notification.resourceNumber}
                        </span>
                        <span className="flex-shrink-0 text-xs text-gray-400">·</span>
                        <Badge
                            className={cn(
                                reasonColors.bg,
                                reasonColors.text,
                                'h-5 flex-shrink-0 px-1.5 py-0 text-xs font-normal',
                            )}
                        >
                            {formatReason(notification.reason)}
                        </Badge>
                        <span className="flex-shrink-0 text-xs text-gray-400">
                            {notification.type}
                        </span>
                        <span className="flex-shrink-0 text-xs text-gray-500">
                            {formatRelativeTime(notification.updatedAt)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function AppliedFilters(props: { ownerRepo: string }) {
    let navigate = useNavigate()
    function reset() {
        return navigate({ to: '/notifications' })
    }

    return (
        <div className="flex items-center gap-2">
            <Badge variant="outline">{props.ownerRepo}</Badge>
            <Button variant="outline" onClick={reset}>
                {' '}
                Reset Filters
            </Button>
        </div>
    )
}

function NotificationList() {
    let cursorState = usePaginationState()
    let search = Route.useSearch()
    let notifications = useTanstackQuery(api.public.notifications.list, {
        ownerRepo: search.ownerRepo,
        paginationOpts: {
            numItems: 25,
            cursor: cursorState.currCursor(),
        },
    })

    let isEmpty = !notifications || notifications.page.length === 0
    let canGoPrev = cursorState.canGoPrev()
    let canGoNext = notifications ? cursorState.canGoNext(notifications) : false

    if (isEmpty) {
        return (
            <div className="border-t border-gray-200 p-6 text-center">
                <div className="mb-1 flex justify-center">
                    <AlertCircle className="h-6 w-6 text-gray-300" />
                </div>
                <h2 className="text-xs font-medium text-gray-900">No notifications</h2>
                <p className="text-xs text-gray-600">You're all caught up!</p>
            </div>
        )
    }

    if (!notifications) return null

    return (
        <div className="flex flex-col">
            {search.ownerRepo && <AppliedFilters ownerRepo={search.ownerRepo} />}

            {/* Scrollable notifications list */}
            <div className="overflow-y-auto border-t border-gray-200">
                {notifications.page.map((n) => (
                    <NotificationRow key={n._id} notification={n} />
                ))}
            </div>

            {/* Fixed pagination at bottom */}
            {cursorState.shouldShowPagination(notifications) && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-1.5">
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            onClick={() => cursorState.goToPrev()}
                            disabled={!canGoPrev}
                            className="h-7 text-xs"
                        >
                            <ChevronLeft className="mr-0.5 h-3 w-3" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => cursorState.goToNext(notifications)}
                            disabled={!canGoNext}
                            className="h-7 text-xs"
                        >
                            Next
                            <ChevronRight className="ml-0.5 h-3 w-3" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
