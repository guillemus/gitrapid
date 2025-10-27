import { Button } from '@/components/ui/button'
import { convex } from '@/lib/convex'
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react'
import { useHookstate } from '@hookstate/core'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'

function Inner() {
    let actions = useAuthActions()
    let auth = useConvexAuth()
    let isLoading = useHookstate(false)

    useEffect(() => {
        if (auth.isAuthenticated) {
            window.location.href = '/notifications'
        }
    }, [auth])

    async function login() {
        isLoading.set(true)
        await actions.signIn('github', { redirectTo: '/notifications' })
        isLoading.set(false)
    }

    return (
        <Button variant="outline" size="lg" onClick={login} disabled={isLoading.get()}>
            <Github className="mr-2 h-4 w-4" />
            {isLoading.get() ? 'Loading...' : 'Continue with GitHub'}
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
