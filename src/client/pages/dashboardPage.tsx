import { PATCard } from '@/components/PATCard'
import { Card, CardContent } from '@/components/ui/card'
import { FastLink } from '@/components/ui/link'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { useFirstLoadQuery, useTanstackQuery } from '@/client/utils'

export function DashboardPage() {
    let firstLoad = useFirstLoadQuery({
        queryKey: ['dashboard'],
        queryFn: (c) => c.query(api.queries.getDashboardPage, {}),
    })
    let { data: page } = useTanstackQuery(convexQuery(api.queries.getDashboardPage, {}))
    let data = page ?? firstLoad

    return (
        <div className="p-6">
            <PATCard />

            <Card>
                <CardContent>
                    <div className="space-y-4">
                        {data && data.length === 0 && <p>No repositories yet.</p>}
                        {!data && <p>Loading...</p>}
                        {data && data.map((repo) => <Repository key={repo._id} repo={repo} />)}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function Repository(props: { repo: Doc<'repos'> }) {
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
