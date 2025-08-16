import { useMutable, useTanstackQuery } from '@/client/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { useAction, useMutation } from 'convex/react'

type Scopes = Doc<'pats'>['scopes']

export function PATCard() {
    const { data: pat, isLoading } = useTanstackQuery(convexQuery(api.queries.getPAT, {}))
    const savePat = useAction(api.actions.savePAT)
    const deletePat = useMutation(api.mutations.deleteMyPAT)

    const state = useMutable({
        showTokenInput: false,
        token: '',
        repoAccess: 'public_repo' as Scopes[number],
        includeNotifications: true,
    })

    function generateTokenUrl() {
        let scopes: Scopes = [state.repoAccess]
        if (state.includeNotifications) scopes.push('notifications')

        let url = new URL('https://github.com/settings/tokens/new')
        url.searchParams.set('scopes', scopes.join(','))

        if (state.repoAccess === 'public_repo') {
            url.searchParams.set('description', 'GitRapid Public Only')
        } else {
            url.searchParams.set('description', 'GitRapid Private and Public')
        }

        return url.toString()
    }

    async function handleSave() {
        const scopes: Scopes = [state.repoAccess]
        if (state.includeNotifications) scopes.push('notifications')

        await savePat({ token: state.token, scopes })

        state.showTokenInput = false
        state.token = ''
    }

    if (isLoading) return null

    if (pat) {
        return (
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        🔑 GitHub Personal Access Token
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                        <span className="text-lg">✅</span>
                        <span>Connected to GitHub</span>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div>
                            <span className="font-medium">Access:</span>
                            {pat.scopes.includes('repo')
                                ? ' Public + Private repositories'
                                : ' Public repositories only'}
                        </div>
                        <div>
                            <span className="font-medium">Notifications:</span>
                            {pat.scopes.includes('notifications') ? ' Enabled' : ' Disabled'}
                        </div>
                        {pat.expiresAt && (
                            <div>
                                <span className="font-medium">Expires:</span>
                                {new Date(pat.expiresAt).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => window.open(generateTokenUrl(), '_blank')}
                        >
                            Regenerate Token
                        </Button>
                        <Button variant="outline" onClick={() => deletePat()}>
                            Remove Token
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    🔑 GitHub Personal Access Token
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-gray-600">
                    Connect your GitHub account to sync repositories and notifications.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium">Repository Access:</label>
                        <div className="space-y-2">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="repoAccess"
                                    value="public_repo"
                                    checked={state.repoAccess === 'public_repo'}
                                    onChange={(e) => {
                                        state.repoAccess = e.target.value as 'public_repo'
                                    }}
                                    className="h-4 w-4"
                                />
                                <span>Public repositories only</span>
                            </label>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="repoAccess"
                                    value="repo"
                                    checked={state.repoAccess === 'repo'}
                                    onChange={(e) => {
                                        state.repoAccess = e.target.value as 'repo'
                                    }}
                                    className="h-4 w-4"
                                />
                                <span>Public + Private repositories</span>
                            </label>
                        </div>
                    </div>

                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={state.includeNotifications}
                            onChange={(e) => (state.includeNotifications = e.target.checked)}
                            className="h-4 w-4"
                        />
                        <span>Include notifications access</span>
                    </label>
                </div>

                <div className="flex gap-2">
                    <Button onClick={() => window.open(generateTokenUrl(), '_blank')}>
                        Generate Token
                    </Button>
                    <Button variant="outline" onClick={() => (state.showTokenInput = true)}>
                        I have a token
                    </Button>
                </div>

                {state.showTokenInput && (
                    <div className="space-y-4 rounded-lg border p-4">
                        <label className="block text-sm font-medium">
                            Paste your GitHub personal access token:
                        </label>
                        <Input
                            type="password"
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            value={state.token}
                            onChange={(e) => (state.token = e.target.value)}
                        />
                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={!state.token.trim()}>
                                Save Token
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => (state.showTokenInput = false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
