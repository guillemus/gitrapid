import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FastLink } from '@/components/ui/link'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useMutable, usePreloadedQuery } from '../utils'

export function DashboardPage() {
    let data = usePreloadedQuery(api.public.dashboard.get, {})

    return (
        <div className="space-y-6">
            <AddRepo />
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

function AddRepo() {
    let addRepo = useAction(api.public.dashboard.addRepo)

    let state = useMutable({
        githubUrl: '',
        isAdding: false,
        addRepoError: null as null | {
            title: string
            description: string
        },
    })

    async function handleAddRepo() {
        if (!state.githubUrl.trim()) {
            return
        }

        state.isAdding = true
        state.addRepoError = null

        let res = await addRepo({ githubUrl: state.githubUrl })
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
        } else {
            state.githubUrl = ''
        }

        // Clear the input on success
        state.isAdding = false
    }

    return (
        <Card>
            <CardContent className="p-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Add Repository</h2>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter GitHub repository URL..."
                            value={state.githubUrl}
                            onChange={(e) => (state.githubUrl = e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                        />
                        <Button
                            onClick={handleAddRepo}
                            disabled={state.isAdding || !state.githubUrl.trim()}
                        >
                            {state.isAdding ? 'Adding...' : 'Add Repo'}
                        </Button>
                    </div>

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
    let download = useQuery(api.public.dashboard.getDownload, {
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

                        {download && (
                            <div className="mt-1 text-sm text-gray-600">
                                <div>Status: {download.status}</div>
                                {download.message && (
                                    <div className="text-xs text-gray-500">{download.message}</div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
