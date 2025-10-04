import { queryClient } from '@/client/convex'
import { renderMarkdownToHtml } from '@/client/lib/markdown'
import { formatRelativeTime, useMutable, usePageQuery } from '@/client/utils'
import { GhLabel, GhUser } from '@/components/github'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { GithubUserDoc } from '@convex/models/issueTimelineItems'
import { createFileRoute, Link } from '@tanstack/react-router'
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
import { toast } from 'sonner'
import z from 'zod'

const paramsSchema = z.object({
    owner: z.string(),
    repo: z.string(),
    issue: z.string().transform((val) => parseInt(val)),
})

export const Route = createFileRoute('/_app/$owner/$repo/issues/$issue')({
    params: {
        parse: (s) => paramsSchema.parse(s),
    },
    loader: (ctx) => {
        void queryClient.prefetchQuery(
            convexQuery(api.public.issues.get, {
                owner: ctx.params.owner,
                repo: ctx.params.repo,
                number: ctx.params.issue,
            }),
        )
    },
    component: SingleIssuesPage,
})

type Data = Exclude<FunctionReturnType<typeof api.public.issues.get>, null>
type Comments = Data['comments']
type TimelineItems = Data['timelineItems']

function SingleIssuesPage() {
    let { owner, repo, issue: number } = Route.useParams()

    let data = usePageQuery(api.public.issues.get, { owner, repo, number })

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
                    <h1 className="text-foreground text-4xl">
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
                            {issueBodyMd ? (
                                <IssueBody
                                    author={data.issue.author}
                                    createdAt={data.issue.createdAt}
                                    bodyHtml={issueBodyHtml}
                                />
                            ) : (
                                <EmptyIssueBody
                                    author={data.issue.author}
                                    createdAt={data.issue.createdAt}
                                />
                            )}

                            {/* Timeline items and comments in chronological order */}
                            {renderTimelineItems(data.timelineItems, data.comments)}
                        </div>
                    </div>

                    <AddCommentBox />
                </div>

                {/* Sidebar */}
                <div className="md:col-span-1">
                    <div className="text-sm">
                        {/* Assignees */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Assignees</div>
                            {data.assignees && data.assignees.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {data.assignees.map((assignee, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            <span>{assignee.login}</span>
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
                            {data.labels && data.labels.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {data.labels.map((label) => (
                                        <GhLabel key={label._id} label={label} />
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

function IssueBody(props: { author: GithubUserDoc; createdAt: string; bodyHtml: string }) {
    return (
        <div className="overflow-hidden rounded-md border">
            <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <GhUser user={props.author} />
                        <span className="text-muted-foreground">
                            commented {formatRelativeTime(props.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="prose prose-sm markdown-body max-w-none bg-white p-4 text-black">
                <div dangerouslySetInnerHTML={{ __html: props.bodyHtml }} />
            </div>
        </div>
    )
}

function EmptyIssueBody(props: { author: GithubUserDoc; createdAt: string }) {
    return (
        <div className="overflow-hidden rounded-md border">
            <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <GhUser user={props.author} />
                        <span className="text-muted-foreground">
                            opened {formatRelativeTime(props.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="bg-white p-4 text-black">
                <p className="text-muted-foreground italic">No description provided.</p>
            </div>
        </div>
    )
}

function CommentItem(props: { comment: Comments[number] }) {
    return (
        <div className="overflow-hidden rounded-md border">
            <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <GhUser user={props.comment.author} />
                        <span className="text-muted-foreground">
                            commented {formatRelativeTime(props.comment.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="prose prose-sm markdown-body max-w-none bg-white p-4 text-black">
                <div
                    dangerouslySetInnerHTML={{
                        __html: renderMarkdownToHtml(props.comment.body || ''),
                    }}
                />
            </div>
        </div>
    )
}

function TimelineEvent(props: { event: TimelineItems[number] }) {
    return (
        <div className="flex items-center gap-3 text-sm">
            <TimelineEventIcon event={props.event} />
            <TimelineEventDescription event={props.event} />
            <span className="text-muted-foreground">
                {formatRelativeTime(props.event.createdAt)}
            </span>
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

function sameGithubUser(u1: GithubUserDoc, u2: GithubUserDoc): boolean {
    if (!u1 || u1 === 'github-actions') return false
    if (!u2 || u2 === 'github-actions') return false

    return u1.githubId === u2.githubId
}

function TimelineEventDescription(props: { event: TimelineItems[number] }) {
    let t = props.event.item
    let actor = props.event.actor

    switch (t.type) {
        case 'assigned': {
            let self = sameGithubUser(actor, t.assignee)
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>{self ? 'self-assigned this' : 'assigned'}</span>
                    {!self && <GhUser user={t.assignee} avatarClassName="size-4" />}
                </span>
            )
        }
        case 'unassigned': {
            let self = sameGithubUser(actor, t.assignee)
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>{self ? 'unassigned themselves' : 'unassigned'}</span>
                    {!self && <GhUser user={t.assignee} avatarClassName="size-4" />}
                </span>
            )
        }
        case 'labeled':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>added the label</span>
                    <GhLabel label={t.label} />
                </span>
            )
        case 'unlabeled':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>removed the label</span>
                    <GhLabel label={t.label} />
                </span>
            )
        case 'milestoned':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>added this to the milestone "{t.milestoneTitle}"</span>
                </span>
            )
        case 'demilestoned':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>removed this from the milestone "{t.milestoneTitle}"</span>
                </span>
            )
        case 'closed':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>closed this</span>
                </span>
            )
        case 'reopened':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>reopened this</span>
                </span>
            )
        case 'renamed':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>
                        renamed this from "{t.previousTitle}" to "{t.currentTitle}"
                    </span>
                </span>
            )
        case 'referenced':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    {t.commit ? (
                        <span>referenced a commit {t.commit.oid.slice(0, 7)}</span>
                    ) : (
                        <span>referenced an unknown commit</span>
                    )}
                </span>
            )
        case 'cross_referenced':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>
                        cross-referenced from {t.source.owner}/{t.source.name}#{t.source.number}
                    </span>
                </span>
            )
        case 'locked':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>locked as resolved</span>
                </span>
            )
        case 'unlocked':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>unlocked this conversation</span>
                </span>
            )
        case 'pinned':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>pinned this issue</span>
                </span>
            )
        case 'unpinned':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>unpinned this issue</span>
                </span>
            )
        case 'transferred':
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>
                        transferred this issue from {t.fromRepository.owner}/{t.fromRepository.name}
                    </span>
                </span>
            )
        default:
            return (
                <span className="inline-flex items-center gap-1">
                    <GhUser user={actor} avatarClassName="size-4" />
                    <span>did something</span>
                </span>
            )
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
            return <TimelineEvent key={`timeline-${item.item._id}`} event={item.item} />
        } else {
            return <CommentItem key={`comment-${item.item._id}`} comment={item.item} />
        }
    })
}

function AddCommentBox() {
    let { owner, repo, issue: number } = Route.useParams()
    let addComment = useAction(api.public.issues.addComment)

    let state = useMutable({
        addingComment: false,
        comment: '',
    })

    async function handleAddComment(e: { preventDefault: () => void }) {
        e.preventDefault()

        state.addingComment = true
        let res = await addComment({ owner, repo, number, comment: state.comment })
        state.addingComment = false

        if (res.isErr) {
            if (res.err.type === 'INSUFFICIENT_SCOPES') {
                toast.error(
                    <>
                        <p>The current token doesn't have enough scopes</p>
                        <p>
                            Go to{' '}
                            <Link
                                className="underline"
                                to={`/settings`}
                                search={{ scope: res.err.requiredScope }}
                            >
                                settings
                            </Link>{' '}
                            to add a token with{' '}
                            <Badge variant="outline">{res.err.requiredScope}</Badge> scope
                        </p>
                    </>,
                    {
                        position: 'bottom-center',
                    },
                )
                return
            }
        }
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
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                await handleAddComment(e)
                            }
                        }}
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
