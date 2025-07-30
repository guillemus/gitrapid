import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Route, Routes } from 'react-router'
import { convex, queryClient } from './convex'
import { DashboardPage } from './dashboardPage'
import { LoginPage } from './loginPage'
import { RepoPage } from './repoPage'

function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dash" element={<DashboardPage />} />
                <Route path="/:owner/:repo" element={<RepoPage />} />
                <Route path="/:owner/:repo/tree/*" element={<RepoPage />} />
                <Route path="/:owner/:repo/blob/*" element={<RepoPage />} />
            </Routes>
        </BrowserRouter>
    )
}

export function App() {
    return (
        <ConvexAuthProvider client={convex}>
            <QueryClientProvider client={queryClient}>
                <Router></Router>
                <ReactQueryDevtools client={queryClient}></ReactQueryDevtools>
            </QueryClientProvider>
        </ConvexAuthProvider>
    )
}
