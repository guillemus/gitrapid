/// <reference types="vite/client" />
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'

type RootContext = {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RootContext>()({
    component: RootComponent,
})

function RootComponent() {
    const ctx = Route.useRouteContext()

    return (
        <div id="root-container">
            <QueryClientProvider client={ctx.queryClient}>
                <Outlet />

                {import.meta.env.DEV && (
                    <div className="text-lg">
                        <ReactQueryDevtools />
                    </div>
                )}
            </QueryClientProvider>
            <Toaster position="bottom-center" />
        </div>
    )
}
