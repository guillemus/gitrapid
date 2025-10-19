import { qcPersistent } from '@/client/queryClient'
import { useTanstackQuery } from '@/client/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { useHookstate, type State } from '@hookstate/core'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAction, useMutation, type ReactAction } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_app/dash')({
    component: DashboardPage,
    loader: () => {
        void qcPersistent.prefetchQuery(convexQuery(api.public.dashboard.get, {}))
    },
})

function DashboardPage() {
    let data = useTanstackQuery(api.public.dashboard.get, {})

    return (
        <div className="space-y-6">
            <RepositoryListHeader />
            {!data && (
                <div className="py-8 text-center">
                    <p>Loading...</p>
                </div>
            )}
            {data && data.length > 0 && (
                <div className="divide-y">
                    {data.map((repo) => (
                        <Repository key={repo._id} repo={repo} />
                    ))}
                </div>
            )}
        </div>
    )
}

type RepoState = SearchRepoState | AddRepoState
type SearchRepoState = {
    type: 'search'
    searchInput: string
}
type AddRepoState = {
    type: 'add'
    githubUrl: string
    isAdding: boolean
    addRepoError?: { title: string; description: string }
}

function goToAddRepo(state: State<RepoState>) {
    state.set({ type: 'add', githubUrl: '', isAdding: false, addRepoError: undefined })
}

function goToSearchRepo(state: State<RepoState>) {
    state.set({ type: 'search', searchInput: '' })
}

async function addRepoWithAction(
    state: State<AddRepoState>,
    action: ReactAction<typeof api.public.dashboard.addRepo>,
) {
    if (!state.githubUrl.get().trim()) return

    state.isAdding.set(true)
    state.addRepoError.set(undefined)

    let res = await action({ githubUrl: state.githubUrl.get() })

    state.isAdding.set(false)
    state.githubUrl.set('')

    if (!res.isErr) return

    state.addRepoError.set({
        title: 'Something went wrong',
        description: res.err,
    })

    setTimeout(() => {
        state.addRepoError.set(undefined)
    }, 4000)
}

function RepositoryListHeader() {
    let addRepo = useAction(api.public.dashboard.addRepo)
    let state = useHookstate<RepoState>({ type: 'search', searchInput: '' })

    if (state.type.value === 'search') {
        return (
            <div className="flex justify-end gap-4">
                <Button onClick={() => goToAddRepo(state)}>Add repository</Button>
            </div>
        )
    }

    let s = state as State<AddRepoState>

    return (
        <div className="flex flex-col gap-4">
            <div className="flex w-full gap-4">
                <Input
                    placeholder="Paste GitHub repo URL (e.g. github.com/owner/repo)"
                    className="w-full"
                    value={s.githubUrl.get()}
                    onChange={(e) => s.merge({ githubUrl: e.target.value })}
                    onEnter={() => addRepoWithAction(s, addRepo)}
                />

                <div className="flex gap-1">
                    <Button
                        disabled={s.isAdding.get() || !s.githubUrl.get().trim()}
                        onClick={() => addRepoWithAction(s, addRepo)}
                    >
                        {s.isAdding.get() ? 'Adding...' : 'Submit'}
                    </Button>
                    <Button variant="outline" onClick={() => goToSearchRepo(state)}>
                        Cancel
                    </Button>
                </div>
            </div>
            {s.addRepoError.get() && (
                <div className="mt-2 min-h-[32px]">
                    {s.addRepoError.get() && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="font-medium">{s.addRepoError.get()?.title}</div>
                                <div className="mt-1 text-sm">
                                    {s.addRepoError.get()?.description}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}
        </div>
    )
}

function Repository(props: { repo: Doc<'repos'> }) {
    let downloadStatus = useTanstackQuery(api.public.dashboard.getDownloadStatus, {
        repoId: props.repo._id,
    })

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
                    <Link
                        to="/$owner/$repo/issues"
                        params={{ owner: props.repo.owner, repo: props.repo.repo }}
                        className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        {props.repo.owner}/{props.repo.repo}
                    </Link>
                    {props.repo.private && (
                        <Badge variant="secondary" className="text-xs">
                            Private
                        </Badge>
                    )}
                </div>
                {downloadStatus && downloadStatus !== 'completed' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                        <Badge
                            variant={downloadStatus === 'failed' ? 'destructive' : 'secondary'}
                            className="rounded-full px-2 py-1 text-xs"
                        >
                            {getDownloadStatusMsg(downloadStatus)}
                        </Badge>
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

function getDownloadStatusMsg(
    status: FunctionReturnType<typeof api.public.dashboard.getDownloadStatus>,
) {
    if (status === 'completed') return null
    if (status === 'inProgress') return 'syncing'

    return status
}
