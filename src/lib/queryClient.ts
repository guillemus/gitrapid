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

function createQueryClient(
    convex: ConvexReactClient,
    options: ({ persisted: false } | { persisted: true; dbname: string }) & {
        gcTime?: number
    },
) {
    const convexQueryClient = new ConvexQueryClient(convex)
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                queryKeyHashFn: convexQueryClient.hashFn(),
                queryFn: convexQueryClient.queryFn(),
                gcTime: options.gcTime,
            },
        },
    })
    convexQueryClient.connect(queryClient)

    if (options.persisted) {
        void persistQueryClient(queryClient, options.dbname)
    }

    return queryClient
}

let day = 24 * 60 * 60 * 1000
let days = day

export const qcMaxDurable = createQueryClient(convex, {
    dbname: 'react-query-cache-durable',
    persisted: true,
    // https://stackoverflow.com/questions/77815938/what-is-the-maximum-duration-i-can-set-to-gctime-cachetime-in-react-query
    // Just to be safe, let's use 10 days.
    gcTime: 10 * days,
})

// query client that persists queries to indexeddb. Use for subscriptions that
// aren't very dynamic (get issue, list user repos, ...).
export const qcPersistent = createQueryClient(convex, {
    dbname: 'react-query-cache',
    persisted: true,
    gcTime: 1 * day,
})

// query client that doesn't persist queries. Do use for subscriptions that are
// very dynamic (filtering issues).
export const qcMem = createQueryClient(convex, { persisted: false })

export const defaultQc = qcPersistent

export function useLogout() {
    const authActions = useAuthActions()
    const navigate = useNavigate()

    return async () => {
        await authActions.signOut()
        await navigate({ to: '/login' })
    }
}
