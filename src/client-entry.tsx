import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { qcDefault } from './lib/query-client'

const router = createRouter({ routeTree, context: { queryClient: qcDefault } })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

export function ClientEntry() {
    return <RouterProvider router={router} />
}
