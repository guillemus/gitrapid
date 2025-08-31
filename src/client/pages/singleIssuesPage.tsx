import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Calendar, CheckCircle, MessageCircle, Plus, User } from 'lucide-react'
import { formatRelativeTime, useGithubParams, usePageQuery } from '../utils'
import { useParams } from 'react-router'
import { api } from '@convex/_generated/api'

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

    if (!data) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        )
    }

    let { issue, issueBodies, issueComments } = data
    let issueBody = issueBodies[0]?.body || ''
    let commentCount = issue.comments || 0

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                    <h1 className="text-foreground truncate text-2xl font-semibold md:text-3xl">
                        {issue.title}
                        <span className="text-muted-foreground ml-2 font-normal">
                            #{issue.number}
                        </span>
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-normal">
                        <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                                issue.state === 'open'
                                    ? 'border-green-200 bg-green-100 text-green-800'
                                    : 'border-red-200 bg-red-100 text-red-800'
                            }`}
                        >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {issue.state === 'open' ? 'Open' : 'Closed'}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <User className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-muted-foreground">{issue.author.login}</span>
                        <span className="text-muted-foreground">•</span>
                        <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-muted-foreground">
                            opened {formatRelativeTime(issue.createdAt)}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <MessageCircle className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-muted-foreground">
                            {commentCount} comment{commentCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {/* Labels below title */}
                    {issue.labels && issue.labels.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {issue.labels.map((label, index) => (
                                <Badge
                                    key={index}
                                    variant="outline"
                                    className="border-gray-200 bg-gray-100 text-xs text-gray-800"
                                >
                                    {label}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                        Edit
                    </Button>
                    <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        New comment
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-red-200 bg-transparent text-red-600"
                    >
                        {issue.state === 'open' ? 'Close issue' : 'Reopen issue'}
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {/* Conversation */}
                <div className="md:col-span-2">
                    <div className="relative">
                        <div
                            className="bg-border absolute top-0 bottom-0 left-4 w-px"
                            aria-hidden
                        />
                        <div className="space-y-6 pl-8">
                            {/* Issue description */}
                            {issueBody && (
                                <div className="overflow-hidden rounded-md border">
                                    <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2 text-xs">
                                        <div className="bg-muted h-8 w-8 shrink-0 rounded-full" />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium">
                                                    {issue.author.login}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    commented {formatRelativeTime(issue.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                                        <div dangerouslySetInnerHTML={{ __html: issueBody }} />
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            {issueComments.map((comment) => (
                                <div
                                    key={comment.githubId}
                                    className="overflow-hidden rounded-md border"
                                >
                                    <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2 text-xs">
                                        <div className="bg-muted h-8 w-8 shrink-0 rounded-full" />
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
                                    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                                        <div dangerouslySetInnerHTML={{ __html: comment.body }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add comment box */}
                    <div className="mt-6 rounded-md border">
                        <div className="p-4">
                            <div className="mb-2 text-sm font-medium">Add a comment</div>
                            <div className="rounded-md border">
                                <textarea
                                    rows={5}
                                    className="bg-background placeholder:text-muted-foreground w-full resize-none rounded-md p-3 text-sm outline-none"
                                    placeholder="Write a comment..."
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" className="bg-transparent">
                                    Preview
                                </Button>
                                <Button size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Comment
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="md:col-span-1">
                    <div className="text-sm">
                        {/* Status */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Status</div>
                            <div className="flex items-center gap-2">
                                {issue.state === 'open' ? (
                                    <AlertCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                    <CheckCircle className="h-4 w-4 text-red-600" />
                                )}
                                <span className="capitalize">{issue.state}</span>
                            </div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Assignees */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Assignees</div>
                            {issue.assignees && issue.assignees.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {issue.assignees.map((assignee, index) => (
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
                            {issue.labels && issue.labels.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {issue.labels.map((label, index) => (
                                        <Badge
                                            key={index}
                                            variant="outline"
                                            className="border-gray-200 bg-gray-100 text-xs text-gray-800"
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

                        {/* Type */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Type</div>
                            <div className="text-muted-foreground">No type</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Projects */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Projects</div>
                            <div className="text-muted-foreground">No projects</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Milestone */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Milestone</div>
                            <div className="text-muted-foreground">No milestone</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Relationships */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Relationships</div>
                            <div className="text-muted-foreground">None yet</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Timeline */}
                        <div className="mb-2">
                            <div className="mb-2 font-medium">Timeline</div>
                            <div className="text-muted-foreground space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Opened {formatRelativeTime(issue.createdAt)}</span>
                                </div>
                                {issue.closedAt && (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        <span>Closed {formatRelativeTime(issue.closedAt)}</span>
                                    </div>
                                )}
                                {issue.updatedAt !== issue.createdAt && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>Updated {formatRelativeTime(issue.updatedAt)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
