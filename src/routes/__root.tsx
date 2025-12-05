/// <reference types="vite/client" />
import { UserMenu } from '@/components/user-menu'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
                title: 'GitHub PR Viewer',
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
            </head>
            <body>
                <QueryClientProvider client={props.queryClient}>
                    {props.children}
                </QueryClientProvider>
                <Scripts />

                <ClientOnly>
                    <Toaster position="bottom-center" />
                </ClientOnly>
                <ClientOnly>
                    <UserMenu />
                </ClientOnly>
            </body>
        </html>
    )
}
