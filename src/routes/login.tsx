import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { useAuthActions } from '@convex-dev/auth/react'
import { useHookstate } from '@hookstate/core'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { Loader2, Zap } from 'lucide-react'

export const Route = createFileRoute('/login')({
    component: LoginPage,
})

function LoginPage() {
    let auth = useConvexAuth()
    let actions = useAuthActions()
    let state = useHookstate({ isLoading: false, error: null as string | null })

    let isLoading = state.isLoading.get() || auth.isLoading || auth.isAuthenticated

    async function handleGitHubLogin() {
        state.set({ isLoading: true, error: null })

        try {
            await actions.signIn('github', { redirectTo: '/dash' })
        } catch {
            state.error.set('Failed to sign in with GitHub. Please try again.')
            state.isLoading.set(false)
        }
    }

    if (auth.isAuthenticated) {
        return <Navigate to="/dash" />
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mb-4 flex items-center justify-center gap-2">
                        <div className="rounded-lg bg-black p-2">
                            <Zap className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900">GitRapid</h1>
                    </div>
                    <p className="text-lg text-slate-600">The fastest GitHub client</p>
                    <p className="mt-1 text-sm text-slate-500">
                        Speed up your development workflow
                    </p>
                </div>

                <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm">
                    <CardHeader className="pb-4 text-center">
                        <CardDescription className="text-slate-600">
                            Sign in to your account to continue
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {state.error.get() && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>{state.error.get()}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            onClick={handleGitHubLogin}
                            disabled={state.isLoading.get()}
                            className="h-12 w-full transform bg-slate-900 font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-slate-800 active:scale-[0.98]"
                            size="lg"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <Github className="mr-2 h-5 w-5" />
                                    Sign in with GitHub
                                </>
                            )}
                        </Button>

                        <div className="pt-4 text-center">
                            <p className="text-xs text-slate-500">
                                {`
                                By signing in, you agree to our terms of service and privacy policy.
                                They aren't written yet, but I'll have them soon. I promise.
                                `}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
