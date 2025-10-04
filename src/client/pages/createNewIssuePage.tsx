import { renderMarkdownToHtml } from '@/client/lib/markdown'
import { useMutable } from '@/client/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@convex/_generated/api'
import { useAction } from 'convex/react'
import { useNavigate, useParams } from 'react-router'

function usePageParams() {
    let { owner, repo } = useParams()

    if (!owner) throw new Error('owner not found')
    if (!repo) throw new Error('repo not found')

    return { owner, repo }
}

// fixme: this page should not allow the user to try to write an issue if he
// doesn't have a PAT with permissions. Otherwise if I error out the github
// error it is terrible user experience, the issue is lost

// fixme: issue persistence to localstorage. The contents should NEVER be lost

export function CreateNewIssuePage() {
    let { owner, repo } = usePageParams()
    let navigate = useNavigate()

    let state = useMutable({
        creatingIssue: false,
        title: '',
        body: '',
        tab: 'write' as 'write' | 'preview',
    })

    let createIssueAction = useAction(api.public.issues.create)

    async function createIssue(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        state.creatingIssue = true
        let res = await createIssueAction({
            owner,
            repo,
            title: state.title,
            body: state.body,
        })
        state.creatingIssue = false

        await navigate(`/${owner}/${repo}/issues/${res.githubIssueNumber}`)
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
                            value={state.title}
                            onChange={(e) => (state.title = e.target.value)}
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
                                        state.tab === 'write'
                                            ? 'text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() => (state.tab = 'write')}
                                >
                                    Write
                                </button>
                                <button
                                    type="button"
                                    className={`rounded px-2 py-1 font-medium ${
                                        state.tab === 'preview'
                                            ? 'text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() => (state.tab = 'preview')}
                                >
                                    Preview
                                </button>
                            </div>
                            <div className="relative">
                                {state.tab === 'write' && (
                                    <textarea
                                        id="description"
                                        rows={12}
                                        className="bg-background placeholder:text-muted-foreground w-full resize-y rounded-md p-3 text-sm outline-none"
                                        placeholder="Type your description here..."
                                        value={state.body}
                                        onChange={(e) => (state.body = e.target.value)}
                                    />
                                )}
                                {state.tab === 'preview' && (
                                    <div className="prose prose-sm markdown-body max-w-none bg-white p-4 text-black">
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: renderMarkdownToHtml(state.body),
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
                                onClick={() => navigate(`/${owner}/${repo}/issues`)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={state.creatingIssue}>
                                {state.creatingIssue ? 'Creating...' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </form>

                {/* Sidebar */}
                <div className="space-y-6">
                    {[
                        { label: 'Assignees', value: 'No one – Assign yourself' },
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
