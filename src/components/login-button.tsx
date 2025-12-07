import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import * as fns from '@/server/functions'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { toast } from 'sonner'

const HAS_LOGGED_IN_KEY = 'hasLoggedIn'

export function LoginButton() {
    const [isLoading, setIsLoading] = useState(false)
    const hasToken = localStorage.getItem(HAS_LOGGED_IN_KEY) !== null
    const [isCheckingSession, setIsCheckingSession] = useState(hasToken)
    const navigate = useNavigate()

    const checkExistingSession = useEffectEvent(async () => {
        if (!hasToken) return

        try {
            const user = await fns.getUser()
            if (user) {
                navigate({ to: '/dashboard' })
                return
            }
            localStorage.removeItem(HAS_LOGGED_IN_KEY)
            toast.error('Session expired, please log in again')
        } catch (error) {
            console.error('Session check failed:', error)
        }
        setIsCheckingSession(false)
    })

    useEffect(() => {
        checkExistingSession()
    }, [])

    const handleLogin = async () => {
        setIsLoading(true)
        try {
            await authClient.signIn.social({
                provider: 'github',
                callbackURL: '/dashboard',
            })
            localStorage.setItem(HAS_LOGGED_IN_KEY, 'true')
        } catch {
            toast.error('Login failed')
        } finally {
            setIsLoading(false)
        }
    }

    if (isCheckingSession) {
        return (
            <Button className="w-full" size="lg" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking session...
            </Button>
        )
    }

    return (
        <Button onClick={handleLogin} className="w-full" size="lg" disabled={isLoading}>
            {isLoading && (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                </>
            )}
            {!isLoading && 'Login with GitHub'}
        </Button>
    )
}
