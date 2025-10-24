import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, formatRelativeTime, usePaginationState, useTanstackQuery } from '@/lib/utils'
import { api } from '@convex/_generated/api'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ChevronLeft, ChevronRight, GitPullRequest, Tag, Zap } from 'lucide-react'

export const Route = createFileRoute('/_app/notifications')({
    component: RouteComponent,
})

function RouteComponent() {
    let cursorState = usePaginationState()
    let notifications = useTanstackQuery(api.public.notifications.list, {
        paginationOpts: {
            numItems: 25,
            cursor: cursorState.currCursor(),
        },
    })

    let isEmpty = !notifications || notifications.page.length === 0
    let canGoPrev = cursorState.canGoPrev()
    let canGoNext = notifications ? cursorState.canGoNext(notifications) : false

    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto max-w-4xl px-4 py-8">
                {/* Notifications List */}
                {isEmpty ? (
                    <Card className="border-gray-200 p-12 text-center">
                        <div className="mb-4 flex justify-center">
                            <AlertCircle className="h-12 w-12 text-gray-300" />
                        </div>
                        <h2 className="mb-1 text-lg font-medium text-gray-900">No notifications</h2>
                        <p className="text-gray-600">You're all caught up!</p>
                    </Card>
                ) : notifications ? (
                    <>
                        <div>
                            {notifications.page.map((n) => (
                                <NotificationRow key={n._id} notification={n} />
                            ))}
                        </div>

                        {/* Pagination */}
                        <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-4">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cursorState.goToPrev()}
                                    disabled={!canGoPrev}
                                >
                                    <ChevronLeft className="mr-1 h-4 w-4" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cursorState.goToNext(notifications)}
                                    disabled={!canGoNext}
                                >
                                    Next
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : null}
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
            return <GitPullRequest className="h-4 w-4" />
        case 'Release':
            return <Tag className="h-4 w-4" />
        case 'Commit':
            return <Zap className="h-4 w-4" />
        case 'Issue':
        default:
            return <AlertCircle className="h-4 w-4" />
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
                'cursor-pointer border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm',
                notification.unread && 'border-blue-200 bg-blue-50',
            )}
            onClick={handleClick}
        >
            <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0 text-gray-400">
                    {getNotificationIcon(notification.type)}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-medium text-gray-900">
                                {notification.title}
                            </h3>
                            <p className="mt-1 text-xs text-gray-600">
                                {notification.repo.owner}/{notification.repo.repo} #
                                {notification.resourceNumber}
                            </p>
                        </div>
                        {notification.unread && (
                            <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn(reasonColors.bg, reasonColors.text, 'font-normal')}>
                            {formatReason(notification.reason)}
                        </Badge>
                        <span className="text-xs text-gray-500">{notification.type}</span>
                        <span className="text-xs text-gray-400">
                            {formatRelativeTime(notification.updatedAt)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
