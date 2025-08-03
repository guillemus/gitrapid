import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FastLink } from '@/components/ui/link'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { queryClient } from './convex'
import {
    useDebounce,
    useFirstLoadQuery,
    useGithubParams,
    useMutable,
    useTanstackQuery,
} from './utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function IssuesPage() {
    let params = useGithubParams()

    let firstLoad = useFirstLoadQuery({
        queryKey: ['issues', params.owner, params.repo],
        queryFn: (c) =>
            c.query(api.queries.listIssues, {
                owner: params.owner,
                repo: params.repo,
            }),
    })

    let search = useMutable({ value: undefined as string | undefined })
    let debouncedSearch = useDebounce(search.value, 150)

    let { data: issues } = useTanstackQuery(
        convexQuery(api.queries.listIssues, {
            owner: params.owner,
            repo: params.repo,
            search: debouncedSearch,
        }),
    )

    let data = issues ?? firstLoad

    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Issues</h1>
                    <p className="text-gray-600">
                        Issues for {params.owner}/{params.repo}
                    </p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    <Input
                        placeholder="Search issues"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={search.value}
                        onChange={(e) => (search.value = e.target.value)}
                    />
                    <Button onClick={() => (search.value = undefined)}>Clear</Button>
                </div>
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
                                                                api.queries.getIssueWithComments,
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
