import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { GitCommitIcon, GitPullRequestIcon, IssueOpenedIcon, TagIcon } from '@primer/octicons-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Archive, ExternalLink, Pin, Star } from 'lucide-react'

export const Route = createFileRoute('/single-notification-mock')({
    component: RouteComponent,
})

type NotificationType = 'PullRequest' | 'Commit' | 'Issue' | 'Release'
type NotificationReason =
    | 'mention'
    | 'comment'
    | 'author'
    | 'assign'
    | 'approval_requested'
    | 'review_requested'
    | 'security_alert'

type TimelineEntry = {
    actor: string
    action: string
    timestamp: Date
}

function RouteComponent() {
    let notification = {
        title: 'Review requested for gitrapid/web#421: Speed up notification syncing',
        repo: { owner: 'gitrapid', repo: 'web' },
        type: 'PullRequest' as NotificationType,
        reason: 'review_requested' as NotificationReason,
        unread: true,
        saved: false,
        pinned: true,
        done: false,
        updatedAt: new Date(Date.now() - 1000 * 60 * 45),
        author: 'guillem',
        body: `Hey team!\n\nThis PR optimizes how we hydrate notification lists by batching the Convex fetch. Would love a second set of eyes on the pagination logic and the new loading skeletons. Let me know what you think.`,
        reviewers: ['sofia-dev', 'hailey'],
        labels: ['performance', 'frontend'],
        branch: 'feat/notification-virtualized-list',
        base: 'main',
    }

    let reasonLabel = getReasonLabel(notification.reason)

    let timeline: Array<TimelineEntry> = [
        {
            actor: 'hailey',
            action: 'left a review comment',
            timestamp: new Date(Date.now() - 1000 * 60 * 12),
        },
        {
            actor: 'guillem',
            action: 'pushed 2 commits to feat/notification-virtualized-list',
            timestamp: new Date(Date.now() - 1000 * 60 * 35),
        },
        {
            actor: 'automations-bot',
            action: 'requested a review from sofia-dev',
            timestamp: new Date(Date.now() - 1000 * 60 * 45),
        },
    ]

    return (
        <div className="flex min-h-screen bg-gray-50">
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="border-b border-gray-200 bg-white px-8 py-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 font-medium tracking-wide text-gray-600 uppercase">
                                        <NotificationIcon type={notification.type} />
                                        {notification.repo.owner}/{notification.repo.repo}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-blue-700 uppercase">
                                        {reasonLabel}
                                    </span>
                                    <span className="text-gray-400">
                                        Updated{' '}
                                        {formatDistanceToNow(notification.updatedAt, {
                                            addSuffix: true,
                                        })}
                                    </span>
                                </div>
                                <h1 className="text-2xl font-semibold text-gray-900">
                                    {notification.title}
                                </h1>
                                <p className="text-sm text-gray-600">
                                    Requested by {notification.author} on `{notification.branch}` →
                                    `{notification.base}`
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" className="gap-1 text-xs">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open on GitHub
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                    <Archive className="h-3.5 w-3.5" />
                                    Mark done
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                    <Star
                                        className={`h-3.5 w-3.5 ${
                                            notification.saved
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-400'
                                        }`}
                                    />
                                    Save
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                    <Pin
                                        className={`h-3.5 w-3.5 ${
                                            notification.pinned
                                                ? 'fill-current text-gray-700'
                                                : 'text-gray-400'
                                        }`}
                                    />
                                    Pin
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            <Checkbox checked={!notification.unread} className="h-3.5 w-3.5" />
                            <span className="font-medium text-gray-600">Mark as read</span>
                            <span className="h-3 w-px bg-gray-200" aria-hidden></span>
                            <span>
                                Reviewers:{' '}
                                {notification.reviewers
                                    .map((reviewer) => `@${reviewer}`)
                                    .join(', ')}
                            </span>
                            <span className="h-3 w-px bg-gray-200" aria-hidden></span>
                            <span className="inline-flex flex-wrap gap-1">
                                {notification.labels.map((label) => (
                                    <span
                                        key={label}
                                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tracking-wide text-gray-600"
                                    >
                                        {label}
                                    </span>
                                ))}
                            </span>
                        </div>
                    </div>
                </header>

                <main className="flex flex-1 flex-col gap-6 px-8 py-6">
                    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-6 text-sm text-gray-500">
                            <span className="font-medium text-gray-700">Conversation</span>
                            <span className="ml-2 text-gray-400">
                                Latest activity synced automatically
                            </span>
                        </div>
                        <article className="space-y-4 text-sm leading-6 text-gray-700">
                            {notification.body.split('\n').map((paragraph) => (
                                <p key={paragraph.slice(0, 16)}>{paragraph}</p>
                            ))}
                        </article>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white p-0 shadow-sm">
                        <header className="border-b border-gray-200 px-6 py-4">
                            <h2 className="text-sm font-semibold text-gray-700">Timeline</h2>
                        </header>
                        <div className="divide-y divide-gray-100 text-sm text-gray-600">
                            {timeline.map((entry) => (
                                <div
                                    key={entry.actor + entry.timestamp.toISOString()}
                                    className="flex items-center gap-4 px-6 py-4"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600 uppercase">
                                        {entry.actor.slice(0, 2)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-gray-700">
                                            <span className="font-medium text-gray-900">
                                                @{entry.actor}
                                            </span>{' '}
                                            {entry.action}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {formatDistanceToNow(entry.timestamp, {
                                                addSuffix: true,
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>

            <aside className="hidden w-80 border-l border-gray-200 bg-white px-6 py-8 lg:flex lg:flex-col lg:gap-8">
                <section className="space-y-4">
                    <div>
                        <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                            Quick actions
                        </h3>
                        <p className="mt-1 text-xs text-gray-400">
                            Manage this notification exactly like in the multi-list view.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button variant="secondary" size="sm">
                            Mark as done
                        </Button>
                        <Button variant="outline" size="sm">
                            Add note
                        </Button>
                        <Button variant="outline" size="sm">
                            Snooze 1 day
                        </Button>
                    </div>
                </section>

                <section className="space-y-4">
                    <div>
                        <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                            Details
                        </h3>
                    </div>
                    <dl className="space-y-3 text-sm text-gray-600">
                        <div>
                            <dt className="font-medium text-gray-700">Repository</dt>
                            <dd className="text-gray-500">
                                {notification.repo.owner}/{notification.repo.repo}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-medium text-gray-700">Branch</dt>
                            <dd className="text-gray-500">{notification.branch}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-gray-700">Base</dt>
                            <dd className="text-gray-500">{notification.base}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-gray-700">Reason</dt>
                            <dd className="text-gray-500">{reasonLabel}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-gray-700">Status</dt>
                            <dd className="flex items-center gap-2 text-gray-500">
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-blue-700 uppercase">
                                    Needs review
                                </span>
                                {notification.unread ? (
                                    <span className="text-[11px] font-medium text-blue-500 uppercase">
                                        Unread
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-gray-400 uppercase">
                                        Read
                                    </span>
                                )}
                            </dd>
                        </div>
                    </dl>

                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                        Looking for history? The timeline keeps a trimmed copy of the last few sync
                        events so the UI mirrors GitHub without needing to click away.
                    </div>

                    <div className="text-xs text-gray-400">
                        <p>
                            Prototype screen only. Hook up to `api.public.notifications.byId` once
                            the detail endpoint ships.
                        </p>
                        <p className="mt-2">
                            Want to go back?{' '}
                            <Link to="/notifications" className="text-blue-600 hover:underline">
                                Return to inbox
                            </Link>
                        </p>
                    </div>
                </section>
            </aside>
        </div>
    )
}

function getReasonLabel(reason: NotificationReason): string {
    switch (reason) {
        case 'mention':
            return 'Mention'
        case 'comment':
            return 'Comment'
        case 'author':
            return 'Author'
        case 'assign':
            return 'Assigned'
        case 'approval_requested':
            return 'Approval Requested'
        case 'review_requested':
            return 'Review Requested'
        case 'security_alert':
            return 'Security Alert'
    }
}

function NotificationIcon(props: { type: NotificationType }) {
    switch (props.type) {
        case 'Commit':
            return <GitCommitIcon size={16} className="text-gray-600" />
        case 'PullRequest':
            return <GitPullRequestIcon size={16} className="text-gray-600" />
        case 'Issue':
            return <IssueOpenedIcon size={16} className="text-gray-600" />
        case 'Release':
            return <TagIcon size={16} className="text-gray-600" />
    }
}
