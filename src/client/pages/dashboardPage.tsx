import { FastLink } from '@/components/fastLink'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { useAction, useMutation, type ReactAction } from 'convex/react'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useMutable, usePageQuery, useTanstackQuery } from '../utils'

export function DashboardPage() {
    let data = usePageQuery(api.public.dashboard.get, {})

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {data && data.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    <p>No repositories yet.</p>
                </div>
            )}
            {!data && (
                <div className="text-center py-8">
                    <p>Loading...</p>
                </div>
            )}
            {data && data.length > 0 && (
                <>
                    <RepositoryListHeader></RepositoryListHeader>
                    <div className="divide-y">
                        {data.map((repo) => (
                            <Repository key={repo._id} repo={repo} />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

type SearchRepoState = { type: 'search'; searchInput: string }
type AddRepoState = {
    type: 'add'
    githubUrl: string
    isAdding: boolean
    addRepoError?: { title: string; description: string }
}

async function handleAddRepo(
    state: AddRepoState,
    addRepo: ReactAction<typeof api.public.dashboard.addRepo>,
) {
    if (!state.githubUrl.trim()) return

    state.isAdding = true
    state.addRepoError = undefined

    let res = await addRepo({ githubUrl: state.githubUrl })

    state.isAdding = false
    state.githubUrl = ''

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
                description: res.err.err,
            }
        } else res.err satisfies never

        setTimeout(() => {
            state.addRepoError = undefined
        }, 4000)
    }
}

function RepositoryListHeader() {
    let addRepo = useAction(api.public.dashboard.addRepo)
    const searchRepoState: SearchRepoState = { type: 'search', searchInput: '' }
    const addRepoState: AddRepoState = { type: 'add', githubUrl: '', isAdding: false }
    let state = useMutable<{ curr: SearchRepoState | AddRepoState }>({ curr: searchRepoState })

    if (state.curr.type === 'search') {
        let curr = state.curr
        return (
            <div className="flex gap-4">
                <Input
                    placeholder="Find a repository..."
                    className="w-full"
                    value={curr.searchInput}
                    onChange={(e) => (curr.searchInput = e.target.value)}
                />
                <Button onClick={() => (state.curr = addRepoState)}>Add repository</Button>
            </div>
        )
    }

    let curr = state.curr
    return (
        <div className="flex gap-4 flex-col">
            <div className="flex gap-4 w-full">
                <Input
                    placeholder="Paste GitHub repo URL (e.g. github.com/owner/repo)"
                    className="w-full"
                    value={curr.githubUrl}
                    onChange={(e) => (curr.githubUrl = e.target.value)}
                    onEnter={() => handleAddRepo(curr, addRepo)}
                />

                <div className="flex gap-1">
                    <Button
                        disabled={curr.isAdding || !curr.githubUrl.trim()}
                        onClick={() => handleAddRepo(curr, addRepo)}
                    >
                        {curr.isAdding ? 'Adding...' : 'Submit'}
                    </Button>
                    <Button variant="outline" onClick={() => (state.curr = searchRepoState)}>
                        Cancel
                    </Button>
                </div>
            </div>
            {curr.addRepoError && (
                <div className="min-h-[32px] mt-2">
                    {curr.addRepoError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="font-medium">{curr.addRepoError.title}</div>
                                <div className="text-sm mt-1">{curr.addRepoError.description}</div>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}
        </div>
    )
}

function Repository(props: { repo: Doc<'repos'> }) {
    let { data: download } = useTanstackQuery(
        convexQuery(api.public.dashboard.getDownload, {
            repoId: props.repo._id,
        }),
    )

    let removeRepo = useMutation(api.public.dashboard.removeRepo)
    let [isRemoving, setIsRemoving] = useState(false)

    async function handleRemoveRepo() {
        if (confirm('Are you sure you want to remove this repository?')) {
            setIsRemoving(true)
            let result = await removeRepo({ repoId: props.repo._id })
            if (result) {
                alert('Failed to remove repository: ' + result)
            }
            setIsRemoving(false)
        }
    }

    return (
        <div className="flex items-center justify-between p-4">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <FastLink
                        to={`/${props.repo.owner}/${props.repo.repo}`}
                        className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        {props.repo.owner}/{props.repo.repo}
                    </FastLink>
                    {props.repo.private && (
                        <Badge variant="secondary" className="text-xs">
                            Private
                        </Badge>
                    )}
                </div>
                {download && (
                    <div className="mt-2 text-sm text-gray-500 flex gap-2 items-center">
                        {download.status !== 'success' && (
                            <Badge
                                variant={download.status === 'error' ? 'destructive' : 'secondary'}
                                className="text-xs px-2 py-1 rounded-full"
                            >
                                {download.status}
                            </Badge>
                        )}
                        {download.message && (
                            <div className="mt-1 text-xs text-gray-500">{download.message}</div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveRepo}
                    disabled={isRemoving}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                >
                    {isRemoving ? 'Removing...' : 'Remove'}
                </Button>
            </div>
        </div>
    )
}
