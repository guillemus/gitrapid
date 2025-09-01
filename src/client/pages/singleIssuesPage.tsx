import { renderMarkdownToHtml } from '@/client/lib/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@convex/_generated/api'
import { useAction } from 'convex/react'
import { AlertCircle, Plus, User } from 'lucide-react'
import { useMemo } from 'react'
import { useParams } from 'react-router'
import { formatRelativeTime, useMutable, usePageQuery } from '../utils'

function usePageParams() {
    let { owner, repo, number } = useParams()
    if (!owner) throw new Error('owner not found')
    if (!repo) throw new Error('repo not found')
    if (!number) throw new Error('number not found')

    let numberInt = parseInt(number)
    if (isNaN(numberInt)) throw new Error('number is not a number')

    return { owner, repo, number: numberInt }
}

SingleIssuesPage.path = '/:owner/:repo/issues/:number'

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
                            {/* Issue description */}
                            {issueBodyMd && (
                                <div className="overflow-hidden rounded-md border">
                                    <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium">
                                                    {data.issue.author.login}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    commented{' '}
                                                    {formatRelativeTime(data.issue.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="prose prose-sm markdown-body max-w-none bg-white p-4 text-black">
                                        <div dangerouslySetInnerHTML={{ __html: issueBodyHtml }} />
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            {data.comments.map((comment) => (
                                <div
                                    key={comment.githubId}
                                    className="overflow-hidden rounded-md border"
                                >
                                    <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium">
                                                    {comment.author.login}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    commented{' '}
                                                    {formatRelativeTime(comment.createdAt)}
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
                            ))}
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
