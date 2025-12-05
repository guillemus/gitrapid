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
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import '../globals.css'

interface RouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                title: 'gitrapid',
            },
        ],
    }),
    component: RootComponent,
})

function RootComponent() {
    const { queryClient } = Route.useRouteContext()
    return (
        <RootDocument queryClient={queryClient}>
            <Outlet />
        </RootDocument>
    )
}

function RootDocument(props: Readonly<{ children: ReactNode; queryClient: QueryClient }>) {
    return (
        <html>
            <head>
                <HeadContent />
                {/* <script crossOrigin="anonymous" src="//unpkg.com/react-scan/dist/auto.global.js" ></script> */}
                {import.meta.env.DEV && (
                    <>
                        <script src="//unpkg.com/react-grab/dist/index.global.js"></script>
                    </>
                )}
            </head>
            <body>
                <QueryClientProvider client={props.queryClient}>
                    {props.children}
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
