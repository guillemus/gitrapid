import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router'
import { convex, queryClient } from './convex'
import { DashboardPage } from './dashboardPage'
import { LoginPage } from './loginPage'
import { RepoPage } from './repoPage'
import { Header } from './header'
import { IssuesPage } from './issuesPage'
import { SingleIssuePage } from './singleIssuePage'
import { Authenticated, Unauthenticated } from 'convex/react'

function AppLayout() {
    let params = useParams()

    return (
        <div className="h-screen w-full">
            <div>
                <Header owner={params.owner} repo={params.repo} />
            </div>
            <Authenticated>
                <Outlet></Outlet>
            </Authenticated>
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
                    <Route path="/:owner/:repo" element={<RepoPage />} />
                    <Route path="/:owner/:repo/tree/*" element={<RepoPage />} />
                    <Route path="/:owner/:repo/blob/*" element={<RepoPage />} />
                    <Route path="/:owner/:repo/issues" element={<IssuesPage />} />
                    <Route path="/:owner/:repo/issues/:issueNumber" element={<SingleIssuePage />} />
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
