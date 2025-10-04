import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { convex, queryClient } from '@/client/convex'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

export function Main() {
    return (
        <ConvexAuthProvider client={convex}>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
                {/* <ReactQueryDevtools client={queryClient}></ReactQueryDevtools> */}
            </QueryClientProvider>
        </ConvexAuthProvider>
    )
}
