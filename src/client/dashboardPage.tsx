import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FastLink } from '@/components/ui/link'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { installationsHandle, useFirstLoadQuery, useTanstackQuery } from './utils'
import type { Doc } from '@convex/_generated/dataModel'

export function DashboardPage() {
    let firstLoad = useFirstLoadQuery({
        queryKey: ['dashboard'],
        queryFn: (c) => c.query(api.queries.getDashboardPage, {}),
    })
    let { data: page } = useTanstackQuery(convexQuery(api.queries.getDashboardPage, {}))
    let data = page ?? firstLoad

    return (
        <div className="p-6">
            <Card>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Your installed repositories</h3>
                            <Button asChild>
                                <a
                                    href={`https://github.com/apps/${installationsHandle}/installations/new`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Install / Uninstall repositories
                                </a>
                            </Button>
                        </div>
                        {data && data.length === 0 && <p>No repositories installed yet.</p>}
                        {!data && <p>Loading...</p>}
                        {data &&
                            data.map(({ repo, installation }) => (
                                <InstalledRepository
                                    key={`${repo.owner}/${repo.repo}`}
                                    repo={repo}
                                    installation={installation}
                                />
                            ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

type InstalledRepositoryProps = {
    repo: Doc<'repos'>
    installation: Doc<'installations'>
}

function InstalledRepository(props: InstalledRepositoryProps) {
    return (
        <div className="grid grid-cols-6 gap-3">
            <Card className="transition-all hover:shadow-md">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <FastLink
                                to={`/${props.repo.owner}/${props.repo.repo}`}
                                className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                                {props.repo.owner}/{props.repo.repo}
                            </FastLink>
                            <div className="mt-1 text-sm text-gray-600">
                                Repository by {props.repo.owner}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {props.repo.private && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                    Private
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
