import { renderMarkdownToHtml } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useHookstate } from '@hookstate/core'
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/$owner/$repo/issues/new')({
    component: CreateNewIssuePage,
})

// fixme: this page should not allow the user to try to write an issue if he
// doesn't have a PAT with permissions. Otherwise if I error out the github
// error it is terrible user experience, the issue is lost

// fixme: issue persistence to localstorage. The contents should NEVER be lost

function CreateNewIssuePage() {
    let { owner, repo } = Route.useParams()
    let navigate = useNavigate()

    let state = useHookstate({
        createdIssueId: null as Id<'issues'> | null,
        creatingIssue: false,
        title: '',
        body: '',
        tab: 'write' as 'write' | 'preview',
    })

    let createIssueMutation = useMutation(api.public.issues.create)

    let createdIssueParams = 'skip' as 'skip' | { issueId: Id<'issues'> }
    let createdIssueId = state.createdIssueId.get()
    if (createdIssueId) {
        createdIssueParams = { issueId: createdIssueId }
    }
    let createdIssue = useQuery(api.public.issues.getById, createdIssueParams)

    async function createIssue(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        state.creatingIssue.set(true)
        try {
            let issueId = await createIssueMutation({
                owner,
                repo,
                title: state.title.get(),
                body: state.body.get(),
            })
            if (issueId.isErr) {
                if (issueId.err === 'PAT_NOT_FOUND') {
                    toast.error('Token not found', {
                        position: 'bottom-center',
                        description: (
                            <p>
                                Go to{' '}
                                <Link className="underline" to="/settings">
                                    settings
                                </Link>{' '}
                                to add a new token
                            </p>
                        ),
                    })

                    return
                } else throw issueId.err
            }

            state.createdIssueId.set(issueId.val)
        } catch {
            toast.error('Failed to create issue')
        } finally {
            state.creatingIssue.set(false)
        }
    }

    if (createdIssue?.githubId) {
        return (
            <Navigate
                to={`/$owner/$repo/issues/$issue`}
                params={{ owner, repo, issue: createdIssue.githubId }}
            />
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-medium">Create new issue</h1>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Main form */}
                <form className="md:col-span-2" onSubmit={createIssue}>
                    {/* Title */}
                    <div className="space-y-2">
                        <label htmlFor="title" className="text-sm font-medium">
                            Add a title
                        </label>
                        <Input
                            autoFocus
                            required
                            placeholder="Title"
                            id="title"
                            value={state.title.get()}
                            onChange={(e) => state.title.set(e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div className="mt-6">
                        <label htmlFor="description" className="mb-2 text-sm font-medium">
                            Add a description
                        </label>
                        <div className="rounded-md border">
                            {/* Tabs header */}
                            <div className="bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-sm">
                                <button
                                    type="button"
                                    className={`rounded px-2 py-1 font-medium ${
                                        state.tab.get() === 'write'
                                            ? 'text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() => state.tab.set('write')}
                                >
                                    Write
                                </button>
                                <button
                                    type="button"
                                    className={`rounded px-2 py-1 font-medium ${
                                        state.tab.get() === 'preview'
                                            ? 'text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() => state.tab.set('preview')}
                                >
                                    Preview
                                </button>
                            </div>
                            <div className="relative">
                                {state.tab.get() === 'write' && (
                                    <textarea
                                        id="description"
                                        rows={12}
                                        className="bg-background placeholder:text-muted-foreground w-full resize-y rounded-md p-3 text-sm outline-none"
                                        placeholder="Type your description here..."
                                        value={state.body.get()}
                                        onChange={(e) => state.body.set(e.target.value)}
                                    />
                                )}
                                {state.tab.get() === 'preview' && (
                                    <div className="prose prose-sm markdown-body max-w-none bg-white p-4 text-black">
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: renderMarkdownToHtml(state.body.get()),
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    navigate({
                                        to: `/$owner/$repo/issues`,
                                        params: { owner, repo },
                                    })
                                }
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={state.creatingIssue.get()}>
                                {state.creatingIssue.get() ? 'Creating...' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </form>

                {/* Sidebar */}
                <div className="space-y-6">
                    {[
                        { label: 'Assignees', value: 'No one - Assign yourself' },
                        { label: 'Labels', value: 'No labels' },
                        { label: 'Type', value: 'No type' },
                        { label: 'Projects', value: 'No projects' },
                        { label: 'Milestone', value: 'No milestone' },
                    ].map((s, idx) => (
                        <div key={idx} className="text-sm">
                            <div className="mb-1.5 flex items-center justify-between">
                                <div className="font-medium">{s.label}</div>
                                <button className="text-muted-foreground hover:text-foreground rounded px-1 text-xs">
                                    ⚙︎
                                </button>
                            </div>
                            <div className="text-muted-foreground">{s.value}</div>
                            {idx < 4 && <div className="bg-border my-4 h-px" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
