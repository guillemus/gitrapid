import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
    component: RouteComponent,
})

function RouteComponent() {
    const session = authClient.useSession()
    const [callbackURL, setCallbackURL] = useState('/')

    useEffect(() => {
        const saved = sessionStorage.getItem('auth_callback')
        if (saved) {
            setCallbackURL(saved)
            sessionStorage.removeItem('auth_callback')
        }
    }, [])

    const [isGithubLoading, setIsGithubLoading] = useState(false)

    const handleLogin = async () => {
        setIsGithubLoading(true)
        await authClient.signIn
            .social({
                provider: 'github',
                callbackURL: callbackURL,
            })
            .finally(() => setIsGithubLoading(false))
    }

    if (session.isPending) {
        return null
    }

    if (session.data?.user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">
                        Welcome back, {session.data.user.name}!
                    </h1>
                    <p className="text-gray-600 mb-4">Navigate to a repository to get started</p>
                    <p className="text-sm text-gray-500">e.g., /owner/repo/pulls</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full text-center p-8">
                <h1 className="text-4xl font-bold mb-2">gitpr.fast</h1>
                <p className="text-gray-600 mb-8">A fast open source GitHub UI</p>

                <Button
                    onClick={handleLogin}
                    className="w-full"
                    size="lg"
                    disabled={isGithubLoading}
                >
                    {isGithubLoading && 'Loading...'}
                    {!isGithubLoading && 'Login with GitHub'}
                </Button>

                <p className="text-sm text-gray-500 mt-4">
                    Access your GitHub pull requests with a fast, modern interface
                </p>
            </div>
        </div>
    )
}
