import { Button } from '@/components/ui/button'
import { convex } from '@/lib/convex'
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { useConvexAuth } from 'convex/react'
import { useEffect, useState } from 'react'

function Inner() {
    let actions = useAuthActions()
    let auth = useConvexAuth()
    let [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (auth.isAuthenticated) {
            window.location.href = '/notifications'
        }
    }, [auth])

    async function login() {
        setIsLoading(true)
        await actions.signIn('github', { redirectTo: '/notifications' })
        setIsLoading(false)
    }

    return (
        <Button variant="outline" size="lg" onClick={login} disabled={isLoading}>
            <Github className="mr-2 h-4 w-4" />
            {isLoading ? 'Loading...' : 'Continue with GitHub'}
        </Button>
    )
}

export function LoginButton() {
    return (
        <ConvexAuthProvider client={convex}>
            <Inner></Inner>
        </ConvexAuthProvider>
    )
}
