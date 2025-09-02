import { renderMarkdownToHtml } from '@/client/lib/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@convex/_generated/api'
import { useAction } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import {
    AlertCircle,
    CheckCircle2,
    Edit,
    GitCommit,
    MoveRight,
    Pin,
    PinOff,
    Plus,
    RotateCcw,
    Tag,
    Unlock,
    User,
    UserMinus,
    UserPlus,
} from 'lucide-react'
import { useMemo } from 'react'
import { useParams } from 'react-router'
import { formatRelativeTime, useMutable, usePageQuery } from '../utils'

function usePageParams() {
    let { owner, repo, number } = useParams()
    if (!owner) throw new Error('owner not found')
    if (!repo) throw new Error('repo not found')
    if (!number) throw new Error('number not found')

    let numberInt = parseInt(number)
    if (Number.isNaN(numberInt)) throw new Error('number is not a number')

    return { owner, repo, number: numberInt }
}

SingleIssuesPage.path = '/:owner/:repo/issues/:number'

type Data = Exclude<FunctionReturnType<typeof api.public.issues.get>, null>
type Comments = Data['comments']
type TimelineItems = Data['timelineItems']

export function SingleIssuesPage() {
    let { owner, repo, number } = usePageParams()

    let data = usePageQuery(api.public.issues.get, {
        owner,
        repo,
        number,
    })

    // Compute markdown HTML before any early return to keep hooks order stable
    let issueBodyMd = data?.body?.body || ''
    let issueBodyHtml = useMemo(() => renderMarkdownToHtml(issueBodyMd), [issueBodyMd])

    if (!data) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                    <h1 className="text-foreground truncate text-4xl">
                        {data.issue.title}
                        <span className="text-muted-foreground ml-2 font-normal">
                            #{data.issue.number}
                        </span>
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-normal">
                        <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                                data.issue.state === 'open'
                                    ? 'border-green-200 bg-green-100 text-green-800'
                                    : 'border-red-200 bg-red-100 text-red-800'
                            }`}
                        >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {data.issue.state === 'open' ? 'Open' : 'Closed'}
                        </span>
                    </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                    <Button size="sm" className="gap-2">
                        New issue
                    </Button>
                </div>
            </div>

            <div className="bg-border h-px" />

            {/* Content */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {/* Conversation */}
                <div className="md:col-span-2">
                    <div className="relative">
                        <div className="space-y-6 pl-8">
                            {/* Issue description - always first */}
                            {issueBodyMd && (
                                <IssueBody
                                    author={data.issue.author.login}
                                    createdAt={data.issue.createdAt}
                                    bodyHtml={issueBodyHtml}
                                />
                            )}

                            {/* Timeline items and comments in chronological order */}
                            {renderTimelineItems(data.timelineItems, data.comments)}
                        </div>
                    </div>

                    {/* Add comment box */}
                    <AddCommentBox></AddCommentBox>
                </div>

                {/* Sidebar */}
                <div className="md:col-span-1">
                    <div className="text-sm">
                        {/* Assignees */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Assignees</div>
                            {data.issue.assignees && data.issue.assignees.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {data.issue.assignees.map((assignee, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            <span>{assignee}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>No one assigned</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Labels */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Labels</div>
                            {data.issue.labels && data.issue.labels.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {data.issue.labels.map((label, index) => (
                                        <Badge
                                            key={index}
                                            variant="outline"
                                            className="border-gray-200 bg-gray-100 text-gray-800"
                                        >
                                            {label}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground">No labels</div>
                            )}
                        </div>
                        <div className="bg-border my-4 h-px" />
                    </div>
                </div>
            </div>
        </div>
    )
}

function IssueBody({
    author,
    createdAt,
    bodyHtml,
}: {
    author: string
    createdAt: string
    bodyHtml: string
}) {
    return (
        <div className="overflow-hidden rounded-md border">
            <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{author}</span>
                        <span className="text-muted-foreground">
                            commented {formatRelativeTime(createdAt)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="prose prose-sm markdown-body max-w-none bg-white p-4 text-black">
                <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </div>
        </div>
    )
}

function CommentItem({ comment }: { comment: Comments[number] }) {
    return (
        <div className="overflow-hidden rounded-md border">
            <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{comment.author.login}</span>
                        <span className="text-muted-foreground">
                            commented {formatRelativeTime(comment.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="prose prose-sm markdown-body max-w-none bg-white p-4 text-black">
                <div
                    dangerouslySetInnerHTML={{
                        __html: renderMarkdownToHtml(comment.body || ''),
                    }}
                />
            </div>
        </div>
    )
}

function TimelineEvent({ event }: { event: TimelineItems[number] }) {
    return (
        <div className="flex items-center gap-3 text-sm">
            <TimelineEventIcon event={event} />
            <span>{describeTimelineEvent(event)}</span>
            <span className="text-muted-foreground">{formatRelativeTime(event.createdAt)}</span>
        </div>
    )
}

function TimelineEventIcon({ event }: { event: TimelineItems[number] }) {
    switch (event.item.type) {
        case 'assigned':
            return <UserPlus className="h-4 w-4" />
        case 'unassigned':
            return <UserMinus className="h-4 w-4" />
        case 'labeled':
        case 'unlabeled':
            return <Tag className="h-4 w-4" />
        case 'milestoned':
        case 'demilestoned':
            return <MoveRight className="h-4 w-4" />
        case 'closed':
            return <CheckCircle2 className="h-4 w-4" />
        case 'reopened':
            return <RotateCcw className="h-4 w-4" />
        case 'renamed':
            return <Edit className="h-4 w-4" />
        case 'referenced':
        case 'cross_referenced':
            return <GitCommit className="h-4 w-4" />
        case 'locked':
            return <AlertCircle className="h-4 w-4" />
        case 'unlocked':
            return <Unlock className="h-4 w-4" />
        case 'pinned':
            return <Pin className="h-4 w-4" />
        case 'unpinned':
            return <PinOff className="h-4 w-4" />
        case 'transferred':
            return <MoveRight className="h-4 w-4" />
        default:
            return <AlertCircle className="h-4 w-4" />
    }
}

function describeTimelineEvent(event: TimelineItems[number]): string {
    let actor = event.actor.login
    let t = event.item
    switch (t.type) {
        case 'assigned':
            // Check if user is assigning to themselves
            if (actor === t.assignee.login) {
                return `${actor} self-assigned this`
            }
            return `${actor} assigned ${t.assignee.login}`
        case 'unassigned':
            // Check if user is unassigning themselves
            if (actor === t.assignee.login) {
                return `${actor} unassigned themselves`
            }
            return `${actor} unassigned ${t.assignee.login}`
        case 'labeled':
            return `${actor} added the label ${t.label.name}`
        case 'unlabeled':
            return `${actor} removed the label ${t.label.name}`
        case 'milestoned':
            return `${actor} added this to the milestone ${t.milestoneTitle}`
        case 'demilestoned':
            return `${actor} removed this from the milestone ${t.milestoneTitle}`
        case 'closed':
            return `${actor} closed this`
        case 'reopened':
            return `${actor} reopened this`
        case 'renamed':
            return `${actor} renamed this from "${t.previousTitle}" to "${t.currentTitle}"`
        case 'referenced':
            return `${actor} referenced a commit ${t.commit.oid.slice(0, 7)}`
        case 'cross_referenced':
            return `${actor} cross-referenced from ${t.source.owner}/${t.source.name}#${t.source.number}`
        case 'locked':
            return `${actor} locked as resolved`
        case 'unlocked':
            return `${actor} unlocked this conversation`
        case 'pinned':
            return `${actor} pinned this issue`
        case 'unpinned':
            return `${actor} unpinned this issue`
        case 'transferred':
            return `${actor} transferred this issue from ${t.fromRepository.owner}/${t.fromRepository.name}`
        default:
            return `${actor} did something`
    }
}

function renderTimelineItems(timelineItems: TimelineItems, comments: Comments) {
    // Combine timeline items and comments, sort by createdAt
    let allItems: Array<
        | {
              type: 'timeline'
              item: TimelineItems[number]
              createdAt: string
          }
        | {
              type: 'comment'
              item: Comments[number]
              createdAt: string
          }
    > = []

    for (let item of timelineItems) {
        allItems.push({ type: 'timeline', item, createdAt: item.createdAt })
    }

    for (let comment of comments) {
        allItems.push({ type: 'comment', item: comment, createdAt: comment.createdAt })
    }

    // Sort by creation time (oldest first)
    allItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return allItems.map((item) => {
        if (item.type === 'timeline') {
            return <TimelineEvent key={`timeline-${item.createdAt}`} event={item.item} />
        } else {
            return <CommentItem key={`comment-${item.item._id}`} comment={item.item} />
        }
    })
}

function AddCommentBox() {
    let { owner, repo, number } = usePageParams()
    let addComment = useAction(api.public.issues.addComment)

    let state = useMutable({
        addingComment: false,
        comment: '',
    })

    async function handleAddComment(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        state.addingComment = true
        await addComment({
            owner,
            repo,
            number,
            comment: state.comment,
        })
        state.addingComment = false
        state.comment = ''
    }

    return (
        <div className="mt-6 rounded-md border">
            <form className="p-4" onSubmit={handleAddComment}>
                <div className="mb-2 text-sm font-medium">Add a comment</div>
                <div className="rounded-md border">
                    <textarea
                        rows={5}
                        onChange={(e) => (state.comment = e.target.value)}
                        value={state.comment}
                        className="bg-background placeholder:text-muted-foreground w-full resize-none rounded-md p-3 text-sm outline-none"
                        placeholder="Write a comment..."
                    />
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="bg-transparent">
                        Preview
                    </Button>
                    <Button
                        type="submit"
                        size="sm"
                        className="gap-2"
                        disabled={state.addingComment}
                    >
                        <Plus className="h-4 w-4" />
                        {state.addingComment ? 'Adding...' : 'Comment'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
