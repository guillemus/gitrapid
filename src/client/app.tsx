// Here we initialize the main app dependencies. We keep this separated from the
// main app to not have any hmr inconsistencies.

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Route, Routes } from 'react-router'

import { CodeBrowser } from './github-code-browser'
import { queryClient } from './queryClient'
import { SearchPage } from './search-page'
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

function GithubSearchPage() {
    return (
        <div className="flex h-screen w-screen">
            <aside className="h-full w-90 overflow-y-auto border-r bg-gray-100 p-4">
                <Sidebar />
            </aside>
            <main className="h-full flex-1 overflow-hidden">
                <SearchPage />
            </main>
        </div>
    )
}

import { ClerkProvider } from '@clerk/clerk-react'
import { Login } from './login'

export function App() {
    return (
        <ClerkProvider publishableKey={import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY}>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/:owner/:repo" element={<GithubCodeBrowser />} />
                        <Route path="/:owner/:repo/tree/:ref/*" element={<GithubCodeBrowser />} />
                        <Route path="/:owner/:repo/blob/:ref/*" element={<GithubCodeBrowser />} />
                        <Route path="/:owner/:repo/search" element={<GithubSearchPage />} />
                    </Routes>
                </BrowserRouter>
                <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
        </ClerkProvider>
    )
}
