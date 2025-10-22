import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { qcPersistent } from '@/lib/queryClient'
import { useTanstackQuery } from '@/lib/utils'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { hookstate, useHookstate } from '@hookstate/core'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import {
    AlertCircle,
    AlertCircleIcon,
    CheckCircle,
    Clock,
    Copy,
    ExternalLink,
    Info,
    RefreshCw,
    Trash2,
} from 'lucide-react'
import z from 'zod'

const search = z.object({
    scope: z.string().optional(),
})

export const Route = createFileRoute('/_app/settings')({
    validateSearch: (s) => search.parse(s),
    loader: (opts) => {
        if (opts.preload) {
            void qcPersistent.prefetchQuery(convexQuery(api.public.settings.get, {}))
        }
    },
    component: SettingsPage,
})

// We can have a 'none' scope, which in github means that it is just read only
// access. It isn't really a scope, it's just that the user gives permission to
// GitRapid to read stuff for him. Best for trying out the app.
type ScopeWithNone = Doc<'pats'>['scopes'][0]

type ScopeOption = {
    scope: ScopeWithNone
    label: string
    description: string
}

const SCOPE_OPTIONS: ScopeOption[] = [
    {
        scope: 'public_repo',
        label: 'Public Repository Access',
        description: 'Read/write access to public repositories — code, commits, issues, projects',
    },
    {
        scope: 'repo',
        label: 'Full Repository Access',
        description:
            'Read/write access to public and private repositories — full control of code, collaborators, webhooks, and org resources',
    },
    {
        scope: 'notifications',
        label: 'GitHub Notifications',
        description:
            'Notification access — read & mark as read, watch/unwatch, manage subscriptions',
    },
    {
        scope: 'read:org',
        label: 'Organization Access (Required)',
        description:
            'Read-only access to organization membership and teams. Required for GitRapid to function properly.',
    },
]

function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

function isExpiringSoon(expiresAt: string, daysThreshold: number = 7): boolean {
    const now = new Date()
    const expirationDate = new Date(expiresAt)
    const timeDiff = expirationDate.getTime() - now.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
    return daysDiff <= daysThreshold && daysDiff > 0
}

function getExpirationInfo(expiresAt: string) {
    const formattedDate = formatDate(expiresAt)
    const isExpiring = isExpiringSoon(expiresAt)

    return {
        formattedDate,
        isExpiring,
    }
}

let pageState = hookstate({
    tokenInput: '',
    selectedScopes: ['repo', 'notifications', 'read:org'] as ScopeWithNone[],
    shouldUpdateToken: false,
    copyFeedback: false,
    errorMessage: null as string | null,
    isSaving: false,
})

function handleScopeChange(scope: ScopeWithNone, checked: boolean) {
    // Prevent changing read:org scope
    if (scope === 'read:org') return

    if (checked) {
        pageState.selectedScopes.merge([scope])
    } else {
        pageState.selectedScopes.set((s) => s.filter((id) => id !== scope))
    }
}

function generateGitHubUrl() {
    const scopes = pageState.selectedScopes.get().join(',')
    const description = scopes ? `GitRapid (${scopes})` : 'GitRapid'

    const baseUrl = 'https://github.com/settings/tokens/new'
    const params = new URLSearchParams()

    if (scopes) {
        params.set('scopes', scopes)
    }
    params.set('description', description)

    return `${baseUrl}?${params.toString()}`
}

async function copyUrlToClipboard() {
    await navigator.clipboard.writeText(generateGitHubUrl())
    pageState.copyFeedback.set(true)
    setTimeout(() => pageState.copyFeedback.set(false), 2000) // Reset after 2 seconds
}

function CreateTokenCard() {
    let state = useHookstate(pageState)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Create a New Token</CardTitle>
                <CardDescription>
                    <div className="space-y-1">
                        <p>
                            For GitRapid to be able to properly read and write data to GitHub, it
                            needs a personal access token.
                        </p>
                        <p>Choose the scopes that you feel comfortable giving to GitRapid.</p>

                        <div className="mt-4"></div>

                        <Alert>
                            <AlertCircleIcon />
                            <AlertDescription>
                                If you are just checking this app out, feel free to disable all
                                scopes. GitRapid will be able to read public data only.
                            </AlertDescription>
                        </Alert>
                    </div>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Select scopes</h3>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-xs text-gray-600 hover:text-gray-900"
                        >
                            <a
                                href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Info className="mr-1 h-3 w-3" />
                                Learn more about scopes
                            </a>
                        </Button>
                    </div>
                    <TooltipProvider>
                        <div className="grid grid-cols-2 gap-2">
                            {SCOPE_OPTIONS.map((option) => {
                                const isRequired = option.scope === 'read:org'
                                return (
                                    <div
                                        key={option.scope}
                                        className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                                            isRequired
                                                ? 'cursor-not-allowed bg-gray-100'
                                                : 'cursor-pointer hover:bg-gray-100'
                                        }`}
                                        onClick={() => {
                                            if (!isRequired) {
                                                let checked = !state.selectedScopes
                                                    .get()
                                                    .includes(option.scope)
                                                handleScopeChange(option.scope, checked)
                                            }
                                        }}
                                    >
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                id={option.scope}
                                                checked={state.selectedScopes
                                                    .get()
                                                    .includes(option.scope)}
                                                disabled={isRequired}
                                                onCheckedChange={(checked) =>
                                                    handleScopeChange(
                                                        option.scope,
                                                        checked === true,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="flex flex-1 flex-col gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className="text-sm font-medium select-none">
                                                    {option.label}
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="rounded-full text-gray-400 hover:text-gray-600"
                                                        >
                                                            <Info className="h-3.5 w-3.5" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-xs">
                                                        <p className="text-xs">
                                                            {option.description}
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="w-fit font-mono text-xs"
                                            >
                                                {option.scope}
                                            </Badge>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </TooltipProvider>
                </div>

                <Separator />

                <div className="space-y-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">URL Preview</label>
                        <div className="rounded-lg border bg-gray-50 p-3">
                            <div className="flex items-center space-x-2 font-mono text-sm break-all text-gray-700">
                                <span>{generateGitHubUrl()}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={copyUrlToClipboard}
                                    className="h-6 w-6 flex-shrink-0 p-0"
                                >
                                    {state.copyFeedback.get() ? (
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Button asChild disabled={state.selectedScopes.length === 0} className="w-full">
                        <a href={generateGitHubUrl()} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Generate Token
                        </a>
                    </Button>
                </div>

                <div className="border-t pt-2 text-gray-500">
                    <p>
                        After creating your token on GitHub, copy it and paste it in the field
                        above.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

function SettingsPage() {
    const page = useTanstackQuery(api.public.settings.get, {})
    const savePAT = useAction(api.public.settings.savePAT)
    const deletePAT = useMutation(api.public.settings.deletePAT)

    let state = useHookstate(pageState)

    async function handleSaveToken() {
        if (!state.tokenInput.get().trim()) return

        state.isSaving.set(true)
        state.errorMessage.set(null)

        let scopes = [...state.selectedScopes.get()]

        const result = await savePAT({
            token: state.tokenInput.get(),
            scopes,
        })
        if (result.isErr) {
            state.errorMessage.set('Invalid token. Please check that you copied it correctly.')
            setTimeout(() => state.errorMessage.set(null), 4000)
        } else {
            state.tokenInput.set((s) => s.trim())
        }

        state.shouldUpdateToken.set(false)
        state.isSaving.set(false)
    }

    async function handleRemoveToken() {
        await deletePAT()
        state.tokenInput.set('')
    }

    if (page === undefined) return null // loading page

    if (page === 'PAT_NOT_SET') {
        return (
            <div className="mx-auto max-w-2xl px-4">
                <div className="mb-8 text-center">
                    <div className="mb-4 flex items-center justify-center">
                        <h1 className="text-2xl font-semibold text-gray-900">Add GitHub Token</h1>
                    </div>
                    <p className="text-gray-600">
                        Create a personal access token to get started with GitRapid.
                    </p>
                </div>

                <PasteTokenCard handleSaveToken={handleSaveToken} />
                <CreateTokenCard />
            </div>
        )
    }

    // Has Token State (Token Active) - unchanged
    return (
        <div className="mx-auto max-w-2xl px-4">
            <div className="mb-8 text-center">
                <div className="mb-4 flex items-center justify-center">
                    <CheckCircle className="mr-2 h-8 w-8 text-green-600" />
                    <h1 className="text-2xl font-semibold text-gray-900">GitHub Token Active</h1>
                </div>
                <p className="text-gray-600">Your GitHub token is successfully configured</p>
            </div>

            <TokenAlreadyConfiguredCard
                scopes={page.scopes}
                expiresAt={page.expiresAt}
                handleSaveToken={handleSaveToken}
                handleRemoveToken={handleRemoveToken}
            />

            {state.shouldUpdateToken.get() && <CreateTokenCard />}
        </div>
    )
}

function PasteTokenCard(props: { handleSaveToken: () => void }) {
    let state = useHookstate(pageState)

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="text-lg">Paste Your Token</CardTitle>
                <CardDescription>
                    If you already have a GitHub personal access token, paste it below
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="token" className="text-sm font-medium">
                        Personal Access Token
                    </label>
                    <Input
                        id="token"
                        type="password"
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={state.tokenInput.get()}
                        onChange={(e) => state.tokenInput.set(e.target.value)}
                        className="font-mono"
                    />
                    {state.errorMessage.get() && (
                        <div className="mt-2 flex items-center space-x-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
                            <span className="text-sm text-red-600">{state.errorMessage.get()}</span>
                        </div>
                    )}
                </div>
                <div className="flex space-x-2">
                    <Button
                        onClick={props.handleSaveToken}
                        disabled={!state.tokenInput.get().trim() || state.isSaving.get()}
                        className="flex-1"
                    >
                        {state.isSaving.get() ? 'Saving...' : 'Save Token'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function TokenAlreadyConfiguredCard(props: {
    scopes: string[]
    expiresAt: string
    handleSaveToken: () => void
    handleRemoveToken: () => void
}) {
    let { formattedDate, isExpiring } = getExpirationInfo(props.expiresAt)
    let state = useHookstate(pageState)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Current Token</CardTitle>
                <CardDescription>
                    You have a GitHub personal access token configured
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="pat-token" className="text-sm font-medium">
                        Personal Access Token
                    </label>
                    <Input
                        id="pat-token"
                        type="password"
                        value="Don't worry, your token is safe on the server. This input just lets you know it's saved."
                        readOnly
                        disabled
                        className="cursor-not-allowed bg-gray-100 font-mono"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Scopes</label>
                        <div className="flex gap-1 overflow-x-auto">
                            {props.scopes.map((scope) => (
                                <Badge
                                    key={scope}
                                    variant="outline"
                                    className="text-xs whitespace-nowrap"
                                >
                                    {scope}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Expires</label>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">{formattedDate}</span>
                            {isExpiring ? (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                            ) : (
                                <Clock className="h-4 w-4 text-gray-400" />
                            )}
                        </div>
                    </div>
                </div>

                {state.shouldUpdateToken.get() ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="update-token-input" className="text-sm font-medium">
                                Enter new GitHub token
                            </label>
                            <Input
                                id="update-token-input"
                                type="password"
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                value={state.tokenInput.get()}
                                onChange={(e) => state.tokenInput.set(e.target.value)}
                                className="font-mono"
                            />
                            {state.errorMessage.get() && (
                                <div className="mt-2 flex items-center space-x-2">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
                                    <span className="text-sm text-red-600">
                                        {state.errorMessage.get()}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                onClick={props.handleSaveToken}
                                disabled={!state.tokenInput.get().trim() || state.isSaving.get()}
                                className="flex-1"
                            >
                                {state.isSaving.get() ? 'Saving...' : 'Save New Token'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    state.shouldUpdateToken.set(false)
                                    state.tokenInput.set('')
                                    state.errorMessage.set(null)
                                }}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => state.shouldUpdateToken.set(true)}
                            className="flex-1"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Update Token
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={props.handleRemoveToken}
                            className="flex-1"
                        >
                            <Trash2 className="h-4 w-4" />
                            Remove Token
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
