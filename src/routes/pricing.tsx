import { HeaderWithTitle } from '@/components/header'
import { PageContainer } from '@/components/layouts'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pricing')({
    component: PricingPage,
})

function PricingPage() {
    const { data: session } = authClient.useSession()

    const handleCheckout = async () => {
        try {
            // eslint-disable-next-line
            await authClient.checkout({ slug: 'monthly' })
        } catch (error) {
            console.error('Checkout error:', error)
        }
    }

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <HeaderWithTitle title="Pricing"></HeaderWithTitle>

            <div className="flex-1">
                <PageContainer>
                    <div className="max-w-xl mx-auto py-12">
                        <div className="border rounded-lg p-8">
                            <h2 className="text-2xl font-bold mb-2">Monthly Plan</h2>
                            <p className="text-gray-600 mb-4">Perfect for getting started</p>
                            <div className="mb-6">
                                <span className="text-4xl font-bold">$8</span>
                                <span className="text-gray-600 ml-2">/month</span>
                            </div>

                            <ul className="mb-8 space-y-3 text-sm">
                                <li className="flex items-center">
                                    <span className="mr-3">✓</span>
                                    Full access to all features
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-3">✓</span>
                                    Unlimited repositories
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-3">✓</span>
                                    Priority support
                                </li>
                            </ul>

                            {session ? (
                                <Button onClick={() => handleCheckout()} className="w-full">
                                    Subscribe Monthly
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => (window.location.href = '/')}
                                    className="w-full"
                                >
                                    Log in to subscribe
                                </Button>
                            )}
                        </div>
                    </div>
                </PageContainer>
            </div>
        </div>
    )
}
