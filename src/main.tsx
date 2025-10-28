import { defaultQc } from '@/lib/queryClient'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import { RouterProvider, createRouter } from '@tanstack/react-router'
import { convex } from './lib/convex'
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

export function Main() {
    return (
        <ConvexAuthProvider client={convex}>
            <QueryClientProvider client={defaultQc}>
                <RouterProvider router={router} />
                {import.meta.env.DEV && <ReactQueryDevtools />}
            </QueryClientProvider>
        </ConvexAuthProvider>
    )
}
