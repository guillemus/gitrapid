import { Card, CardContent } from '@/components/ui/card'
import { api } from '@convex/_generated/api'
import { useQuery } from 'convex/react'
import { Link } from 'react-router'

export function DashboardPage() {
    let repos = useQuery(api.functions.listInstalledRepos)

    return (
        <div className="p-6">
            <Card>
                <CardContent>
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Your installed repositories</h3>
                        {repos?.length === 0 && <p>No repositories installed yet.</p>}
                        {!repos && <p>Loading...</p>}
                        {repos && (
                            <div className="grid grid-cols-6 gap-3">
                                {repos.map((repo: any) => (
                                    <Card
                                        key={`${repo.owner}/${repo.repo}`}
                                        className="transition-all hover:shadow-md"
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Link
                                                        to={`/${repo.owner}/${repo.repo}`}
                                                        className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {repo.owner}/{repo.repo}
                                                    </Link>
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
