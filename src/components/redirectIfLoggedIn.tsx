import { ConvexAuthProvider, useAuthToken } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'

import { convex } from '@/client/convex'

function RedirectInner(props: { redirectTo?: string }) {
    let { isAuthenticated, isLoading } = useConvexAuth()
    let token = useAuthToken()

    useEffect(
        function onAuthChange() {
            if (!isLoading && (isAuthenticated || token)) {
                let target = props.redirectTo ?? '/dash'
                window.location.replace(target)
            }
        },
        [isLoading, isAuthenticated, token, props.redirectTo],
    )

    return null
}

export function RedirectIfLoggedIn(props: { redirectTo?: string }) {
    return (
        <ConvexAuthProvider client={convex}>
            <RedirectInner redirectTo={props.redirectTo} />
        </ConvexAuthProvider>
    )
}
