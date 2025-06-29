// Here we initialize the main app dependencies. We keep this separated from the
// main app to not have any hmr inconsistencies.

import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { CodeBrowser } from './github-code-browser'
import { queryClient } from './queryClient'
import { Sidebar } from './sidebar'

function GithubCodeBrowser() {
    return (
        <div className="flex h-screen w-screen">
            <aside className="h-full w-90 overflow-y-auto border-r bg-gray-100 p-4">
                <Sidebar />
            </aside>
            <main className="h-full flex-1 overflow-hidden">
                <CodeBrowser />
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
