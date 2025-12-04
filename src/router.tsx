import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 10 * 1000,
            },
        },
    })

    const router = createRouter({
        routeTree,
        scrollRestoration: true,
        context: { queryClient },
        defaultPreloadStaleTime: 0,
    })

    return router
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof getRouter>
    }
}
