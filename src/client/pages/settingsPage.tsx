import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { useAction, useMutation } from 'convex/react'
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Copy,
    ExternalLink,
    Info,
    RefreshCw,
    Trash2,
} from 'lucide-react'
import { proxy, useSnapshot } from 'valtio'
import { usePageQuery } from '../utils'

// We can have a 'none' scope, which in github means that it is just read only
// access. It isn't really a scope, it's just that the user gives permission to
// gitrapid to read stuff for him. Best for trying out the app.
type ScopeWithNone = Doc<'pats'>['scopes'][0] | 'none'

type ScopeOption = {
    scope: ScopeWithNone
    label: string
    description: string
}

const SCOPE_OPTIONS: ScopeOption[] = [
    {
        scope: 'none',
        label: 'No Scope (Read-Only)',
        description:
            'Read-only access to public information (including user profile info, repository info, and gists)',
    },
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

const state = proxy({
    tokenInput: '',
    selectedScopes: ['public_repo', 'notifications'] as ScopeWithNone[],
    shouldUpdateToken: false,
    copyFeedback: false,
    errorMessage: null as string | null,
    isSaving: false,
})

function handleScopeChange(scope: ScopeWithNone, checked: boolean) {
    if (checked) {
        if (scope === 'none') {
            // When selecting 'none', remove repository scopes

            state.selectedScopes = state.selectedScopes.filter(
                (id) => id !== 'public_repo' && id !== 'repo',
            )
            state.selectedScopes.push(scope)
        } else if (scope === 'public_repo' || scope === 'repo') {
            // When selecting repository scopes, remove 'none'
            state.selectedScopes = state.selectedScopes.filter((id) => id !== 'none')
            state.selectedScopes.push(scope)
        } else {
            // For other scopes, just add them
            state.selectedScopes.push(scope)
        }
    } else {
        state.selectedScopes = state.selectedScopes.filter((id) => id !== scope)
    }
}

function generateGitHubUrl() {
    const scopes = state.selectedScopes.filter((scope) => scope !== 'none').join(',')
    const description = scopes ? `gitrapid (${scopes})` : 'gitrapid'

    const baseUrl = 'https://github.com/settings/tokens/new'
    const params = new URLSearchParams()

    if (scopes) {
        params.set('scopes', scopes)
    }
    params.set('description', description)

    return `${baseUrl}?${params.toString()}`
}

function copyUrlToClipboard() {
    navigator.clipboard.writeText(generateGitHubUrl())
    state.copyFeedback = true
    setTimeout(() => (state.copyFeedback = false), 2000) // Reset after 2 seconds
}

function CreateTokenCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Create a New Token</CardTitle>
                <CardDescription>
                    Select the scopes you need and create a token on GitHub
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">Select scopes</h3>
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
                                <Info className="h-3 w-3 mr-1" />
                                Learn more about scopes
                            </a>
                        </Button>
                    </div>
                    {SCOPE_OPTIONS.map((option) => (
                        <div
                            key={option.scope}
                            className="flex items-start space-x-3 p-3 border rounded-lg"
                        >
                            <Checkbox
                                id={option.scope}
                                checked={state.selectedScopes.includes(option.scope)}
                                onCheckedChange={(checked) =>
                                    handleScopeChange(option.scope, checked as boolean)
                                }
                                className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <label
                                        htmlFor={option.scope}
                                        className="text-sm font-medium cursor-pointer"
                                    >
                                        {option.label}
                                    </label>
                                    <Badge variant="outline" className="text-xs font-mono">
                                        {option.scope}
                                    </Badge>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {option.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <Separator />

                <div className="space-y-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">GitHub URL Preview</label>
                        <div className="p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center space-x-2 text-sm font-mono text-gray-700 break-all">
                                <span>{generateGitHubUrl()}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={copyUrlToClipboard}
                                    className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                    {state.copyFeedback ? (
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
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Generate Token on GitHub
                        </a>
                    </Button>
                </div>

                <div className="text-xs text-gray-500 pt-2 border-t">
                    <p>
                        After creating your token on GitHub, copy it and paste it in the field
                        above.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

export function SettingsPage() {
    useSnapshot(state)
    const page = usePageQuery(api.public.settings.get, {})
    const savePAT = useAction(api.public.settings.savePAT)
    const deletePAT = useMutation(api.public.settings.deletePAT)

    async function handleSaveToken() {
        if (!state.tokenInput.trim()) return

        state.isSaving = true
        state.errorMessage = null

        let scopes = state.selectedScopes.filter((s) => s !== 'none')

        const result = await savePAT({
            token: state.tokenInput,
            scopes,
        })

        if (result.isErr) {
            state.errorMessage = 'Invalid token. Please check that you copied it correctly.'
            setTimeout(() => (state.errorMessage = null), 4000)
        } else {
            state.tokenInput = ''
        }

        state.shouldUpdateToken = false
        state.isSaving = false
    }

    function handleRemoveToken() {
        deletePAT()
        state.tokenInput = ''
    }

    if (!page) return null // loading page

    if (page === 'PAT_NOT_SET') {
        return (
            <div className="max-w-2xl mx-auto px-4">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <h1 className="text-2xl font-semibold text-gray-900">Add GitHub Token</h1>
                    </div>
                    <p className="text-gray-600">
                        Create a personal access token to get started with gitrapid
                    </p>
                </div>

                <PasteTokenCard handleSaveToken={handleSaveToken} />
                <CreateTokenCard />
            </div>
        )
    }

    // Has Token State (Token Active) - unchanged
    return (
        <div className="max-w-2xl mx-auto px-4">
            <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600 mr-2" />
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

            {state.shouldUpdateToken && <CreateTokenCard />}
        </div>
    )
}

function PasteTokenCard(props: { handleSaveToken: () => void }) {
    useSnapshot(state)

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
                        value={state.tokenInput}
                        onChange={(e) => (state.tokenInput = e.target.value)}
                        className="font-mono"
                    />
                    {state.errorMessage && (
                        <div className="flex items-center space-x-2 mt-2">
                            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <span className="text-sm text-red-600">{state.errorMessage}</span>
                        </div>
                    )}
                </div>
                <div className="flex space-x-2">
                    <Button
                        onClick={props.handleSaveToken}
                        disabled={!state.tokenInput.trim() || state.isSaving}
                        className="flex-1"
                    >
                        {state.isSaving ? 'Saving...' : 'Save Token'}
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
    useSnapshot(state)
    let { formattedDate, isExpiring } = getExpirationInfo(props.expiresAt)

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

                {state.shouldUpdateToken ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="update-token-input" className="text-sm font-medium">
                                Enter new GitHub token
                            </label>
                            <Input
                                id="update-token-input"
                                type="password"
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                value={state.tokenInput}
                                onChange={(e) => (state.tokenInput = e.target.value)}
                                className="font-mono"
                            />
                            {state.errorMessage && (
                                <div className="flex items-center space-x-2 mt-2">
                                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                    <span className="text-sm text-red-600">
                                        {state.errorMessage}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                onClick={props.handleSaveToken}
                                disabled={!state.tokenInput.trim() || state.isSaving}
                                className="flex-1"
                            >
                                {state.isSaving ? 'Saving...' : 'Save New Token'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    state.shouldUpdateToken = false
                                    state.tokenInput = ''
                                    state.errorMessage = null
                                }}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => (state.shouldUpdateToken = true)}
                            className="flex-1"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Update Token
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={props.handleRemoveToken}
                            className="flex-1"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Token
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
