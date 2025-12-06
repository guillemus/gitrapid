import { auth } from '@/auth'
import { PageContainer } from '@/components/page-container'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/db'
import { polar } from '@/polar'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { useEffect } from 'react'

const syncSubscriptionAfterCheckout = createServerFn({ method: 'POST' }).handler(async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        const customerState = await polar.customers.getStateExternal({
            externalId: session.user.id,
        })

        const activeSub = customerState.activeSubscriptions?.[0]
        const status = activeSub ? activeSub.status : 'none'

        await prisma.subscription.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                polarCustomerId: customerState.id,
                polarSubscriptionId: activeSub?.id ?? null,
                productId: activeSub?.productId ?? null,
                status,
                currentPeriodEnd: activeSub?.currentPeriodEnd ?? null,
            },
            update: {
                polarSubscriptionId: activeSub?.id ?? null,
                productId: activeSub?.productId ?? null,
                status,
                currentPeriodEnd: activeSub?.currentPeriodEnd ?? null,
            },
        })

        return { success: true }
    } catch (error) {
        console.error('Sync failed:', error)
        return { success: false, error: 'Sync failed. Please refresh the page.' }
    }
})

export const Route = createFileRoute('/success')({
    component: SuccessPage,
})

function SuccessPage() {
    const navigate = useNavigate()
    const mutation = useMutation({
        mutationFn: syncSubscriptionAfterCheckout,
        onSuccess: () => {
            navigate({ to: '/' })
        },
    })

    // Sync subscription on mount to handle webhook race conditions and persist checkout data
    useEffect(() => {
        mutation.mutate(undefined)
    }, [mutation])

    if (mutation.isPending) {
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
                            {mutation.error?.message || 'Sync failed. Please refresh the page.'}
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
