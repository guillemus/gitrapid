import { Button } from '@/components/ui/button'
import { useAuthActions } from '@convex-dev/auth/react'

export function LoginPage() {
    const { signIn } = useAuthActions()

    return (
        <Button onClick={() => signIn('github', { redirectTo: '/dash' })}>
            Sign in with GitHub
        </Button>
    )
}
