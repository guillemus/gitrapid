import { useAuthActions, useAuthToken } from '@convex-dev/auth/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ConvexHttpClient } from 'convex/browser'
import { ConvexReactClient } from 'convex/react'
import { persistQueryClient } from './queryPersister'

export const convex = new ConvexReactClient(import.meta.env.PUBLIC_CONVEX_URL!)

export function useConvexHttp() {
    const token = useAuthToken()
    if (!token) return null

    const convexHttp = new ConvexHttpClient(import.meta.env.PUBLIC_CONVEX_URL!)
    convexHttp.setAuth(token)

    return convexHttp
}

function createQueryClient(convex: ConvexReactClient, persisted: boolean) {
    const convexQueryClient = new ConvexQueryClient(convex)
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                queryKeyHashFn: convexQueryClient.hashFn(),
                queryFn: convexQueryClient.queryFn(),
                gcTime: 5 * 60 * 1000, // 5 minutes
            },
        },
    })
    convexQueryClient.connect(queryClient)

    if (persisted) {
        void persistQueryClient(queryClient)
    }

    return queryClient
}

// query client that persists queries to indexeddb. Use for subscriptions that
// aren't very dynamic (get issue, list user repos, ...).
export const qcPersistent = createQueryClient(convex, true)

// query client that doesn't persist queries. Do use for subscriptions that are
// very dynamic (filtering issues).
export const qcMem = createQueryClient(convex, false)

export function useLogout() {
    const authActions = useAuthActions()
    const navigate = useNavigate()

    return async () => {
        await authActions.signOut()
        await navigate({ to: '/login' })
    }
}
