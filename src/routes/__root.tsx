/// <reference types="vite/client" />
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
    ClientOnly,
    createRootRouteWithContext,
    HeadContent,
    Outlet,
    Scripts,
} from '@tanstack/react-router'
import { Toaster } from 'sonner'
import '../globals.css'

interface RouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
    head: () => ({
        meta: [
            { title: 'gitrapid' },
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        ],
        links: [{ rel: 'icon', href: '/favicon.png', type: 'image/png' }],
    }),
    component: RootComponent,
})

function RootComponent() {
    const { queryClient } = Route.useRouteContext()
    return (
        <html>
            <head>
                <HeadContent />
                {/* <script crossOrigin="anonymous" src="//unpkg.com/react-scan/dist/auto.global.js" ></script> */}
                {/* <script src="//unpkg.com/react-grab/dist/index.global.js"></script> */}
            </head>
            <body>
                <QueryClientProvider client={queryClient}>
                    <Outlet />
                    {import.meta.env.DEV && <ReactQueryDevtools></ReactQueryDevtools>}
                </QueryClientProvider>
                <Scripts />

                <ClientOnly>
                    <Toaster position="bottom-center" />
                </ClientOnly>
            </body>
        </html>
    )
}
