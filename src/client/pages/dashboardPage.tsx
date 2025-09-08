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
        <div className="space-y-6">
            <RepositoryListHeader />
            {!data && (
                <div className="py-8 text-center">
                    <p>Loading...</p>
                </div>
            )}
            {data && data.length > 0 && (
                <>
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

type RepoState = { curr: SearchRepoState | AddRepoState }

function initialRepoState() {
    return { curr: new SearchRepoState() }
}

class SearchRepoState {
    searchInput = ''

    goToAddRepo(state: RepoState) {
        state.curr = new AddRepoState()
    }
}

class AddRepoState {
    githubUrl = ''
    isAdding = false
    addRepoError?: { title: string; description: string }

    async addRepoWithAction(action: ReactAction<typeof api.public.dashboard.addRepo>) {
        if (!this.githubUrl.trim()) return

        this.isAdding = true
        this.addRepoError = undefined

        let res = await action({ githubUrl: this.githubUrl })

        this.isAdding = false
        this.githubUrl = ''

        if (!res.isErr) return

        this.addRepoError = {
            title: 'Something went wrong',
            description: res.err,
        }

        setTimeout(() => {
            this.addRepoError = undefined
        }, 4000)
    }

    goToSearchRepo(state: RepoState) {
        state.curr = new SearchRepoState()
    }
}

function RepositoryListHeader() {
    let addRepo = useAction(api.public.dashboard.addRepo)
    let state = useMutable<RepoState>(initialRepoState())
    let curr = state.curr

    if (curr instanceof SearchRepoState) {
        return (
            <div className="flex justify-end gap-4">
                <Button onClick={() => curr.goToAddRepo(state)}>Add repository</Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex w-full gap-4">
                <Input
                    placeholder="Paste GitHub repo URL (e.g. github.com/owner/repo)"
                    className="w-full"
                    value={curr.githubUrl}
                    onChange={(e) => (curr.githubUrl = e.target.value)}
                    onEnter={() => curr.addRepoWithAction(addRepo)}
                />

                <div className="flex gap-1">
                    <Button
                        disabled={curr.isAdding || !curr.githubUrl.trim()}
                        onClick={() => curr.addRepoWithAction(addRepo)}
                    >
                        {curr.isAdding ? 'Adding...' : 'Submit'}
                    </Button>
                    <Button variant="outline" onClick={() => curr.goToSearchRepo(state)}>
                        Cancel
                    </Button>
                </div>
            </div>
            {curr.addRepoError && (
                <div className="mt-2 min-h-[32px]">
                    {curr.addRepoError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="font-medium">{curr.addRepoError.title}</div>
                                <div className="mt-1 text-sm">{curr.addRepoError.description}</div>
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
                        to={`/${props.repo.owner}/${props.repo.repo}/issues`}
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
                {download && download.status !== 'success' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                        <Badge
                            variant={download.status === 'error' ? 'destructive' : 'secondary'}
                            className="rounded-full px-2 py-1 text-xs"
                        >
                            {download.status}
                        </Badge>
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
                    className="text-red-600 hover:bg-red-50 hover:text-red-800"
                >
                    {isRemoving ? 'Removing...' : 'Remove'}
                </Button>
            </div>
        </div>
    )
}
