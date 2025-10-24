import { Header } from '@/components/header'
import { useAuthToken } from '@convex-dev/auth/react'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Unauthenticated, useConvexAuth } from 'convex/react'
import { AlertCircle } from 'lucide-react'
import React, { useEffect } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

function RedirectToHome() {
    useEffect(() => {
        window.location.href = '/'
    }, [])

    return null
}

function AppLayout() {
    return (
        <ErrorBoundary>
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
                    <RedirectToHome />
                </Unauthenticated>
            </div>
        </ErrorBoundary>
    )
}

type Props = { fallback?: React.ReactNode; children: React.ReactNode }
type State = { hasError: boolean; error?: Error }

class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // fixme: Log to monitoring service here
        // e.g., Sentry.captureException(error, { extra: info });
        console.error('ErrorBoundary caught an error:', error, info)
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div className="container mx-auto px-4 py-6">
                        <Card className="mx-auto max-w-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="text-destructive h-5 w-5" />
                                    Something went wrong
                                </CardTitle>
                                <CardDescription>
                                    An unexpected error occurred. Please try refreshing the page.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error Details</AlertTitle>
                                    <AlertDescription>
                                        {this.state.error?.message ?? 'An unknown error occurred'}
                                    </AlertDescription>
                                </Alert>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => window.location.reload()}
                                    >
                                        Refresh Page
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            )
        }

        return this.props.children
    }
}
