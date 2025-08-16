import { useAuthActions } from '@convex-dev/auth/react'
import { Button } from '@/components/ui/button'

export function LoginPage() {
    const { signIn } = useAuthActions()

    return (
        <Button onClick={() => signIn('github', { redirectTo: '/dash' })}>
            Sign in with GitHub
        </Button>
    )
}
