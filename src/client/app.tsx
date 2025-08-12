import { ConvexAuthProvider, useAuthToken } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Unauthenticated, useConvexAuth } from 'convex/react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router'
import { convex, queryClient } from './convex'
import { DashboardPage } from './dashboardPage'
import { Header } from './header'
import { LoginPage } from './loginPage'
import { RepoPage } from './repoPage'
import { useGithubParams } from './utils'

function AuthenticatedWithToken(props: { children: React.ReactNode }) {
    let convexAuth = useConvexAuth()
    let token = useAuthToken()

    if (convexAuth.isAuthenticated || token) {
        return props.children
    }

    return null
}

function AppLayout() {
    let params = useParams()

    return (
        <div className="h-screen w-full">
            <div>
                <Header owner={params.owner} repo={params.repo} />
            </div>
            <AuthenticatedWithToken>
                <Outlet></Outlet>
            </AuthenticatedWithToken>
            <Unauthenticated>
                <Navigate to="/login" />
            </Unauthenticated>
        </div>
    )
}

function RepoLayout() {
    let params = useGithubParams()

    return (
        <div className="h-screen w-full">
            <div>
                <Header showDownloadStatus owner={params.owner} repo={params.repo} />
            </div>
            <AuthenticatedWithToken>
                <Outlet></Outlet>
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
                </Route>
                <Route element={<RepoLayout />}>
                    <Route path="/:owner/:repo" element={<RepoPage />} />
                    <Route path="/:owner/:repo/tree/*" element={<RepoPage />} />
                    <Route path="/:owner/:repo/blob/*" element={<RepoPage />} />
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
