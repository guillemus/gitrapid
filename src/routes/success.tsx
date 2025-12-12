import { PageContainer } from '@/components/layouts'
import { Button } from '@/components/ui/button'
import { trpcClient } from '@/server/trpc-client'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/success')({
    component: SuccessPage,
})

function SuccessPage() {
    const navigate = useNavigate()
    const mutation = useMutation({
        mutationFn: () => trpcClient.syncSubscriptionAfterCheckout.mutate(),
    })

    useEffect(() => {
        mutation.mutate()
    }, [])

    if (mutation.isPending || mutation.isIdle) {
        return (
            <PageContainer>
                <div className="max-w-2xl mx-auto py-12 text-center">
                    <div className="mb-8">
                        <div className="w-16 h-16 mx-auto mb-6 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                    <h1 className="text-4xl font-bold mb-4">Setting up your subscription...</h1>
                    <p className="text-lg text-gray-600">
                        Just a moment while we finalize everything.
                    </p>
                </div>
            </PageContainer>
        )
    }

    return (
        <PageContainer>
            <div className="max-w-2xl mx-auto py-12 text-center">
                {mutation.isError ? (
                    <>
                        <div className="mb-8">
                            <svg
                                className="w-16 h-16 mx-auto text-red-500 mb-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-4xl font-bold mb-4">Oops, something went wrong</h1>
                        <p className="text-lg text-gray-600 mb-8">
                            {mutation.error.message || 'Sync failed. Please refresh the page.'}
                        </p>
                        <Button onClick={() => window.location.reload()} className="inline-block">
                            Refresh Page
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="mb-8">
                            <svg
                                className="w-16 h-16 mx-auto text-green-500 mb-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>

                        <h1 className="text-4xl font-bold mb-4">Thank you for subscribing!</h1>
                        <p className="text-lg text-gray-600 mb-8">
                            Your subscription is now active. You can start using all the features of
                            GitRapid.
                        </p>

                        <Button onClick={() => navigate({ to: '/' })} className="inline-block">
                            Go to Dashboard
                        </Button>
                    </>
                )}
            </div>
        </PageContainer>
    )
}
