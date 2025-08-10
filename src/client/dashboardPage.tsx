import { Card, CardContent } from '@/components/ui/card'
import { FastLink } from '@/components/ui/link'
import { Button } from '@/components/ui/button'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useFirstLoadQuery, useTanstackQuery } from './utils'

export function DashboardPage() {
    let firstLoad = useFirstLoadQuery({
        queryKey: ['dashboard'],
        queryFn: (c) => c.query(api.queries.listInstalledRepos, {}),
    })

    let { data: repos } = useTanstackQuery(convexQuery(api.queries.listInstalledRepos, {}))
    let data = repos ?? firstLoad

    return (
        <div className="p-6">
            <Card>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Your installed repositories</h3>
                            <Button asChild>
                                <a
                                    href="https://github.com/apps/gitrapid-com-dev/installations/new"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Install Repository
                                </a>
                            </Button>
                        </div>
                        {data?.length === 0 && <p>No repositories installed yet.</p>}
                        {!data && <p>Loading...</p>}
                        {data && (
                            <div className="grid grid-cols-6 gap-3">
                                {data.map((repo: any) => (
                                    <Card
                                        key={`${repo.owner}/${repo.repo}`}
                                        className="transition-all hover:shadow-md"
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <FastLink
                                                        to={`/${repo.owner}/${repo.repo}`}
                                                        className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {repo.owner}/{repo.repo}
                                                    </FastLink>
                                                    <div className="mt-1 text-sm text-gray-600">
                                                        Repository by {repo.owner}
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {repo.private && (
                                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                                            Private
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
