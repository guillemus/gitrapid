import { qcDefault } from '@/query-client'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
    const router = createRouter({
        routeTree,
        scrollRestoration: true,
        context: { queryClient: qcDefault },
        defaultPreloadStaleTime: 0,
    })

    return router
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof getRouter>
    }
}
