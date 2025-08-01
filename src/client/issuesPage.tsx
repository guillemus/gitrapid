import { api } from '@convex/_generated/api'
import { useFirstLoadQuery, useGithubParams, useTanstackQuery } from './utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router'
import { convexQuery } from '@convex-dev/react-query'
import { queryClient } from './convex'
import { FastLink } from '@/components/ui/link'

export function IssuesPage() {
    let params = useGithubParams()

    let firstLoad = useFirstLoadQuery({
        queryKey: ['issues', params.owner, params.repo],
        queryFn: (c) =>
            c.query(api.functions.listIssues, {
                owner: params.owner,
                repo: params.repo,
            }),
    })

    let { data: issues } = useTanstackQuery(
        convexQuery(api.functions.listIssues, {
            owner: params.owner,
            repo: params.repo,
        }),
    )

    let data = issues ?? firstLoad

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Issues</h1>
                <p className="text-gray-600">
                    Issues for {params.owner}/{params.repo}
                </p>
            </div>

            <div className="space-y-4">
                {!data && <p>Loading issues...</p>}
                {data?.length === 0 && (
                    <Card>
                        <CardContent className="p-6 text-center">
                            <p className="text-gray-500">No issues found.</p>
                        </CardContent>
                    </Card>
                )}
                {data && data.length > 0 && (
                    <div className="space-y-3">
                        {data.map((issue) => (
                            <Card key={issue._id} className="transition-all hover:shadow-md">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-lg">
                                                <FastLink
                                                    to={`/${params.owner}/${params.repo}/issues/${issue.number}`}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                                    onMouseOver={() => {
                                                        queryClient.prefetchQuery(
                                                            convexQuery(
                                                                api.functions.getIssueWithComments,
                                                                {
                                                                    owner: params.owner,
                                                                    repo: params.repo,
                                                                    issueNumber: issue.number,
                                                                },
                                                            ),
                                                        )
                                                    }}
                                                >
                                                    {issue.title}
                                                </FastLink>
                                            </CardTitle>
                                            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                                                <span>#{issue.number}</span>
                                                <span>opened by {issue.author.login}</span>
                                                <span>
                                                    {new Date(issue.createdAt).toLocaleDateString()}
                                                </span>
                                                {issue.comments && issue.comments > 0 && (
                                                    <span>{issue.comments} comments</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-4 flex items-center space-x-2">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                    issue.state === 'open'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-purple-100 text-purple-800'
                                                }`}
                                            >
                                                {issue.state}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                {issue.body || issue.labels?.length || issue.assignees?.length ? (
                                    <CardContent className="pt-0">
                                        {issue.body && (
                                            <p className="mb-3 line-clamp-2 text-sm text-gray-700">
                                                {issue.body}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
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
                                    </CardContent>
                                ) : null}
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
