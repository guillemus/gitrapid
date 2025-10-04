import { Header } from '@/client/header'
import { useAuthToken } from '@convex-dev/auth/react'
import { Outlet, Navigate, createFileRoute } from '@tanstack/react-router'
import { Unauthenticated, useConvexAuth } from 'convex/react'

export const Route = createFileRoute('/_app')({
    component: AppLayout,
})

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
        <div className="bg-background flex h-screen flex-col">
            <div className="flex-shrink-0">
                <Header />
            </div>
            <AuthenticatedWithToken>
                <div className="scrollbar-gutter-stable flex-1 overflow-y-auto">
                    <div className="container mx-auto px-4 py-6">
                        <Outlet />
                    </div>
                </div>
            </AuthenticatedWithToken>
            <Unauthenticated>
                <Navigate to="/login" />
            </Unauthenticated>
        </div>
    )
}
