import { convex } from '@/client/queryClient'
import { ConvexAuthProvider, useAuthToken } from '@convex-dev/auth/react'
import { useEffect } from 'react'

function RedirectInner() {
    let token = useAuthToken()

    useEffect(() => {
        if (token) {
            window.location.replace('/dash')
        }
    }, [token])

    return null
}

export function RedirectIfLoggedIn() {
    return (
        <ConvexAuthProvider client={convex}>
            <RedirectInner />
        </ConvexAuthProvider>
    )
}
