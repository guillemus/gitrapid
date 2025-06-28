// Here we initialize the main app dependencies. We keep this separated from the
// main app to not have any hmr inconsistencies.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { BrowserRouter, Routes, Route } from 'react-router'
import { Sidebar } from './sidebar'
import { CodeRenderer } from './github-code-browser'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
        },
    },
})

const idbPersister = {
    persistClient: async (client: unknown) => {
        await set('react-query-cache', client)
    },
    restoreClient: async () => {
        return await get('react-query-cache')
    },
    removeClient: async () => {
        await del('react-query-cache')
    },
}

persistQueryClient({
    queryClient,
    persister: idbPersister,
})

function GithubCodeBrowser() {
    return (
        <div className="flex h-screen w-screen">
            <aside className="h-full w-64 overflow-y-auto border-r bg-gray-100 p-4">
                <Sidebar />
            </aside>
            <main className="h-full flex-1 overflow-hidden">
                <CodeRenderer />
            </main>
        </div>
    )
}

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/:owner/:repo" element={<GithubCodeBrowser />} />
                    <Route path="/:owner/:repo/tree/:ref/*" element={<GithubCodeBrowser />} />
                    <Route path="/:owner/:repo/blob/:ref/*" element={<GithubCodeBrowser />} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    )
}
