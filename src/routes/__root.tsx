/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
            </body>
        </html>
    )
}
