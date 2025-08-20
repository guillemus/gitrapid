import { ConvexAuthProvider, useAuthToken } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Unauthenticated, useConvexAuth } from 'convex/react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'

import { convex, queryClient } from '@/client/convex'
import { Header } from '@/client/header'
import { DashboardPage } from '@/client/pages/dashboardPage'
import { LoginPage } from '@/client/pages/loginPage'
import { RepoPage } from '@/client/pages/repoPage'
import { SettingsPage } from '@/client/pages/settingsPage'
import { IssuesPage } from './pages/issuesPage'

function AuthenticatedWithToken(props: { children: React.ReactNode }) {
    let convexAuth = useConvexAuth()
    let token = useAuthToken()

    if (convexAuth.isAuthenticated || token) {
        return props.children
    }

    return null
}

function AppLayout() {
    return (
        <div className="min-h-screen bg-background">
            <div>
                <Header />
            </div>
            <AuthenticatedWithToken>
                <div className="container mx-auto px-4 py-6">
                    <Outlet></Outlet>
                </div>
            </AuthenticatedWithToken>
            <Unauthenticated>
                <Navigate to="/login" />
            </Unauthenticated>
        </div>
    )
}

function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<AppLayout />}>
                    <Route path="/dash" element={<DashboardPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/:owner/:repo" element={<RepoPage />} />
                    <Route path="/:owner/:repo/tree/*" element={<RepoPage />} />
                    <Route path="/:owner/:repo/blob/*" element={<RepoPage />} />
                    <Route path="/:owner/:repo/issues" element={<IssuesPage />} />
                </Route>
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
