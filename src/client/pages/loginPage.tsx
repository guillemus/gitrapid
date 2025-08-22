import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthActions } from '@convex-dev/auth/react'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { Loader2, Zap } from 'lucide-react'
import { useState } from 'react'

export function LoginPage() {
    let actions = useAuthActions()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleGitHubLogin() {
        setIsLoading(true)
        setError(null)

        try {
            await actions.signIn('github', { redirectTo: '/dash' })
        } catch (err) {
            setError('Failed to sign in with GitHub. Please try again.')
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="p-2 bg-black rounded-lg">
                            <Zap className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900">gitrapid</h1>
                    </div>
                    <p className="text-slate-600 text-lg">The fastest GitHub client</p>
                    <p className="text-slate-500 text-sm mt-1">
                        Speed up your development workflow
                    </p>
                </div>

                <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                    <CardHeader className="text-center pb-4">
                        <CardTitle className="text-xl text-slate-900">Welcome back</CardTitle>
                        <CardDescription className="text-slate-600">
                            Sign in to your account to continue
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            onClick={handleGitHubLogin}
                            disabled={isLoading}
                            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
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

                        <div className="text-center pt-4">
                            <p className="text-xs text-slate-500">
                                By signing in, you agree to our terms of service and privacy policy
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
