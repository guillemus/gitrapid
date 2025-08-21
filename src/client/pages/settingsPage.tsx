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
    Copy,
    ExternalLink,
    Info,
    Key,
    RefreshCw,
    Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { usePageQuery } from '../utils'

type Scope = Doc<'pats'>['scopes'][0] | 'none'

export function SettingsPage() {
    const page = usePageQuery(api.public.settings.get, {})
    const savePAT = useAction(api.public.settings.savePAT)
    const deletePAT = useMutation(api.public.settings.deletePAT)

    const [tokenInput, setTokenInput] = useState('')
    const [selectedScopes, setSelectedScopes] = useState<Scope[]>([
        'public_repo',
        'notifications',
    ] as const)
    const [copyFeedback, setCopyFeedback] = useState(false)

    function generateGitHubUrl() {
        const scopes = selectedScopes.filter((scope) => scope !== 'none').join(',')
        const description = scopes ? `gitrapid (${scopes})` : 'gitrapid'

        const baseUrl = 'https://github.com/settings/tokens/new'
        const params = new URLSearchParams()

        if (scopes) {
            params.set('scopes', scopes)
        }
        params.set('description', description)

        return `${baseUrl}?${params.toString()}`
    }

    function handleScopeChange(scope: Scope, checked: boolean) {
        if (checked) {
            if (scope === 'none') {
                // When selecting 'none', remove repository scopes
                setSelectedScopes((prev) => [
                    ...prev.filter((id) => id !== 'public_repo' && id !== 'repo'),
                    scope,
                ])
            } else if (scope === 'public_repo' || scope === 'repo') {
                // When selecting repository scopes, remove 'none'
                setSelectedScopes((prev) => [...prev.filter((id) => id !== 'none'), scope])
            } else {
                // For other scopes, just add them
                setSelectedScopes((prev) => [...prev, scope])
            }
        } else {
            setSelectedScopes((prev) => prev.filter((id) => id !== scope))
        }
    }

    function handleSaveToken() {
        if (!tokenInput.trim()) return

        let scopes = selectedScopes.filter((s) => s !== 'none')
        savePAT({
            token: tokenInput,
            scopes,
        })

        setTokenInput('')
    }

    function handleUpdateToken() {
        setTokenInput('')
        setSelectedScopes(['public_repo', 'notifications'])
    }

    function handleRemoveToken() {
        deletePAT()
        setTokenInput('')
    }

    function handleCopyUrl() {
        navigator.clipboard.writeText(generateGitHubUrl())
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 2000) // Reset after 2 seconds
    }

    if (!page) return null // loading page

    if (page === 'PAT_NOT_SET') {
        return (
            <div className="max-w-2xl mx-auto px-4">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <Key className="h-8 w-8 text-gray-600 mr-2" />
                        <h1 className="text-2xl font-semibold text-gray-900">
                            Connect GitHub Account
                        </h1>
                    </div>
                    <p className="text-gray-600">
                        Create a personal access token to get started with gitrapid
                    </p>
                </div>

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
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                className="font-mono"
                            />
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                onClick={handleSaveToken}
                                disabled={!tokenInput.trim()}
                                className="flex-1"
                            >
                                Save Token
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Or Create a New Token</CardTitle>
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
                                        checked={selectedScopes.includes(option.scope)}
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
                                            onClick={handleCopyUrl}
                                            className="h-6 w-6 p-0 flex-shrink-0"
                                        >
                                            {copyFeedback ? (
                                                <CheckCircle className="h-3 w-3 text-green-600" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Button
                                asChild
                                disabled={selectedScopes.length === 0}
                                className="w-full"
                            >
                                <a
                                    href={generateGitHubUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Generate Token on GitHub
                                </a>
                            </Button>
                        </div>

                        <div className="text-xs text-gray-500 pt-2 border-t">
                            <p>
                                After creating your token on GitHub, copy it and paste it in the
                                field above.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Has Token State (Connected) - unchanged
    return (
        <div className="min-h-screen py-8">
            <div className="max-w-2xl mx-auto px-4">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600 mr-2" />
                        <h1 className="text-2xl font-semibold text-gray-900">GitHub Connected</h1>
                    </div>
                    <p className="text-gray-600">
                        Your GitHub account is successfully connected to gitrapid
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Key className="h-5 w-5" />
                            <span>Connection Status</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Scopes</span>
                            <div className="flex space-x-1">
                                {page.scopes.map((scope) => (
                                    <Badge key={scope} variant="outline" className="text-xs">
                                        {scope}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Expires</span>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600">{page.expiresAt}</span>
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Manage Connection</CardTitle>
                        <CardDescription>
                            Update your access level or remove the connection entirely
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                onClick={handleUpdateToken}
                                className="flex-1 bg-transparent"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Update Token
                            </Button>
                            <Button variant="destructive" onClick={handleRemoveToken}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Token
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

type ScopeOption = {
    scope: Scope
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
