import { ConvexAuthProvider, useAuthToken } from '@convex-dev/auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Unauthenticated, useConvexAuth } from 'convex/react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'

import { convex, queryClient } from '@/client/convex'
import { Header, type HeaderProps } from '@/client/header'
import { DashboardPage } from '@/client/pages/dashboardPage'
import { IssuesPage } from '@/client/pages/issuesPage'
import { LoginPage } from '@/client/pages/loginPage'
import { SettingsPage } from '@/client/pages/settingsPage'

function AuthenticatedWithToken(props: { children: React.ReactNode }) {
    let convexAuth = useConvexAuth()
    let token = useAuthToken()

    if (convexAuth.isAuthenticated || token) {
        return props.children
    }

    return null
}

function AppLayout({ tab }: { tab: HeaderProps['tab'] }) {
    return (
        <div className="bg-background flex h-screen flex-col">
            <div className="flex-shrink-0">
                <Header tab={tab} />
            </div>
            <AuthenticatedWithToken>
                <div className="scrollbar-gutter-stable flex-1 overflow-y-auto">
                    <div className="container mx-auto px-4 py-6">
                        <Outlet></Outlet>
                    </div>
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

                <Route element={<AppLayout tab="none" />}>
                    <Route path="/dash" element={<DashboardPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route element={<AppLayout tab="issues" />}>
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
                {/* <ReactQueryDevtools client={queryClient}></ReactQueryDevtools> */}
            </QueryClientProvider>
        </ConvexAuthProvider>
    )
}
