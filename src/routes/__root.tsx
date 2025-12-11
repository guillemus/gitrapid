/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import '../globals.css'

interface RouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootComponent,
})

function RootComponent() {
    return (
        <div id="root-container">
            <Outlet />
            {import.meta.env.DEV && (
                <div className="text-lg">
                    <ReactQueryDevtools />
                </div>
            )}
            <Toaster position="bottom-center" />
        </div>
    )
}
