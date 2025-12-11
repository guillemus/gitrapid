import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/lib/query-client'

export function LoginButton() {
    const user = useUser()
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (user.data) {
            // this file is important to have it not depend on tanstack router,
            // because when rendered in the landing it won't have the router context
            window.location.href = '/dashboard'
        }
    }, [user.data])

    const handleLogin = async () => {
        setIsLoading(true)
        try {
            await authClient.signIn.social({
                provider: 'github',
                callbackURL: '/dashboard',
            })
        } catch {
            toast.error('Login failed')
            setIsLoading(false)
        }
    }

    if (user.isLoading) {
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
