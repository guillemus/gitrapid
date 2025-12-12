import { RouterProvider, createRouter } from '@tanstack/react-router'
import { initBotId } from 'botid/client/core'

import { qcDefault } from './lib/query-client'
import { routeTree } from './routeTree.gen'

initBotId({
    protect: [
        { method: 'GET', path: '/api/trpc/*' },
        { method: 'POST', path: '/api/trpc/*' },
    ],
})

const router = createRouter({ routeTree, context: { queryClient: qcDefault } })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

export function ClientEntry() {
    return <RouterProvider router={router} />
}
