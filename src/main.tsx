import { convex, qcPersistent } from '@/client/convex'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
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
            <QueryClientProvider client={qcPersistent}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </ConvexAuthProvider>
    )
}
