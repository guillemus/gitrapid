import { api } from '@convex/_generated/api'
import { useQuery } from 'convex/react'
import { useParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function usePageParams() {
    let params = useParams()
    let owner = params.owner
    let repo = params.repo
    let issueNumber = Number(params.issueNumber)

    if (!owner || !repo || !issueNumber || isNaN(issueNumber)) {
        throw new Error('Invalid params')
    }

    return { owner, repo, issueNumber }
}

export function SingleIssuePage() {
    let { owner, repo, issueNumber } = usePageParams()

    let result = useQuery(api.functions.getIssue, {
        owner,
        repo,
        issueNumber,
    })

    if (!result) {
        return (
            <div className="p-6">
                <p>Loading issue...</p>
            </div>
        )
    }

    const { issue, comments } = result

    return (
        <div className="p-6">
            {/* Issue Header */}
            <div className="mb-6">
                <div className="mb-2 flex items-center space-x-2">
                    <h1 className="text-2xl font-bold">{issue.title}</h1>
                    <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                            issue.state === 'open'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-purple-100 text-purple-800'
                        }`}
                    >
                        {issue.state}
                    </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>#{issue.number}</span>
                    <span>opened by {issue.author.login}</span>
                    <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                    <span>updated {new Date(issue.updatedAt).toLocaleDateString()}</span>
                    {issue.closedAt && (
                        <span>closed {new Date(issue.closedAt).toLocaleDateString()}</span>
                    )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {issue.labels?.map((label) => (
                        <span
                            key={label}
                            className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
                        >
                            {label}
                        </span>
                    ))}
                    {issue.assignees?.map((assignee) => (
                        <span
                            key={assignee}
                            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
                        >
                            assigned to {assignee}
                        </span>
                    ))}
                </div>
            </div>

            {/* Issue Body */}
            {issue.body && (
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center space-x-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                                <span className="text-sm font-medium text-blue-800">
                                    {issue.author.login?.[0]?.toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <p className="font-medium">{issue.author.login}</p>
                                <p className="text-sm text-gray-600">
                                    commented on {new Date(issue.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="prose max-w-none">
                            <pre className="font-sans whitespace-pre-wrap">{issue.body}</pre>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Comments */}
            {comments && comments.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Comments ({comments.length})</h2>
                    {comments.map((comment) => (
                        <Card key={comment._id} className={comment.isDeleted ? 'opacity-50' : ''}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                                            <span className="text-sm font-medium text-gray-700">
                                                {comment.author.login?.[0]?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium">{comment.author.login}</p>
                                            <p className="text-sm text-gray-600">
                                                commented on{' '}
                                                {new Date(comment.createdAt).toLocaleDateString()}
                                                {comment.updatedAt !== comment.createdAt && (
                                                    <span> • edited</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {comment.isDeleted && (
                                        <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                                            Deleted
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="prose max-w-none">
                                    <pre className="font-sans whitespace-pre-wrap">
                                        {comment.body}
                                    </pre>
                                </div>
                                {comment.reactions && comment.reactions.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {comment.reactions.map((reaction, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs"
                                                title={`${reaction.user.login} reacted with ${reaction.content}`}
                                            >
                                                {reaction.content} {reaction.user.login}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* No comments state */}
            {comments && comments.length === 0 && (
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-gray-500">No comments yet.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
