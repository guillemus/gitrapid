import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FastLink } from '@/components/ui/link'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import type { FoundRepo } from '@convex/public/dashboard'
import { useAction, useQuery } from 'convex/react'
import { useMutable, usePreloadedQuery } from '../utils'

export function DashboardPage() {
    let data = usePreloadedQuery(api.public.dashboard.get, {})

    return (
        <div className="space-y-6">
            <RepositorySearch />
            <Card>
                <CardContent>
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Your Repositories</h2>
                        {data && data.length === 0 && <p>No repositories yet.</p>}
                        {!data && <p>Loading...</p>}
                        {data && data.map((repo) => <Repository key={repo._id} repo={repo} />)}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function RepositorySearch() {
    let searchRepos = useAction(api.public.dashboard.searchRepo)
    let addRepo = useAction(api.public.dashboard.addRepo)

    let state = useMutable({
        query: '',
        results: [] as FoundRepo[],
        isSearching: false,
        addRepoError: null as null | {
            title: string
            description: string
        },
    })

    async function handleSearch(query: string) {
        if (!query.trim()) {
            state.results = []
            return
        }

        state.isSearching = true
        let result = await searchRepos({ query })
        if (!result.isErr) {
            state.results = result.val
        } else {
            console.error('Search failed:', result.err)
        }
        state.isSearching = false
    }

    async function handleRepoAdd(repo: FoundRepo) {
        let res = await addRepo(repo)
        if (res.isErr) {
            if (res.err.type === 'error') {
                state.addRepoError = {
                    title: 'Something went wrong',
                    description: res.err.err,
                }
            } else if (res.err.type === 'license-not-found') {
                state.addRepoError = {
                    title: 'License not found',
                    description: 'The repository does not have a license, so we cannot add it.',
                }
            } else if (res.err.type === 'license-not-supported') {
                state.addRepoError = {
                    title: 'License not supported',
                    description: `The repository uses the ${res.err.spdxId} license, which is not supported.`,
                }
            } else if (res.err.type === 'octo-error') {
                state.addRepoError = {
                    title: 'Something went wrong',
                    description: res.err.err.error(),
                }
            } else res.err satisfies never

            return
        }
    }

    return (
        <Card>
            <CardContent className="p-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Search Repositories</h2>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search for repositories..."
                            value={state.query}
                            onChange={(e) => (state.query = e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(state.query)}
                        />
                        <Button
                            onClick={() => handleSearch(state.query)}
                            disabled={state.isSearching}
                        >
                            {state.isSearching ? 'Searching...' : 'Search'}
                        </Button>
                    </div>

                    {state.results.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-medium">Search Results</h3>
                            {state.results.map((repo, index) => (
                                <div key={index} className="rounded-lg border p-3">
                                    <div className="font-medium">
                                        {repo.owner} / {repo.repo}
                                    </div>
                                    {repo.description && (
                                        <div className="mt-1 text-sm text-gray-600">
                                            {repo.description}
                                        </div>
                                    )}

                                    <div className="mt-2 flex items-center gap-2">
                                        <a
                                            href={repo.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            View on GitHub
                                        </a>
                                        <Button
                                            size="sm"
                                            onClick={() => handleRepoAdd(repo)}
                                            className="ml-auto"
                                        >
                                            Add Repository
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {state.addRepoError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <div className="font-medium text-red-800">
                                {state.addRepoError.title}
                            </div>
                            <div className="mt-1 text-sm text-red-600">
                                {state.addRepoError.description}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function Repository(props: { repo: Doc<'repos'> }) {
    let downloadStatus = useQuery(api.public.dashboard.getDownloadStatus, {
        repoId: props.repo._id,
    })

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

                        {downloadStatus && (
                            <div className="mt-1 text-sm text-gray-600">
                                <div>Status: {downloadStatus.status}</div>
                                {downloadStatus.message && (
                                    <div className="text-xs text-gray-500">
                                        {downloadStatus.message}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
