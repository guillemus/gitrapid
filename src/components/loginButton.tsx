import { Button } from '@/components/ui/button'
import { convex } from '@/lib/convex'
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'

function Inner() {
    let actions = useAuthActions()
    let auth = useConvexAuth()

    useEffect(() => {
        if (auth.isAuthenticated) {
            window.location.href = '/notifications'
        }
    }, [auth])

    async function login() {
        await actions.signIn('github', { redirectTo: '/notifications' })
    }

    return (
        <Button variant="outline" size="lg" onClick={login}>
            <Github className="mr-2 h-4 w-4" />
            Continue with GitHub
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
