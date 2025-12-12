import { PageContainer } from '@/components/page-container'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pricing')({
    component: PricingPage,
})

function PricingPage() {
    const { data: session } = authClient.useSession()

    const handleCheckout = async (slug: 'monthly' | 'yearly') => {
        if (!session) {
            window.location.href = '/'
            return
        }

        try {
            // eslint-disable-next-line
            await authClient.checkout({ slug })
        } catch (error) {
            console.error('Checkout error:', error)
        }
    }

    return (
        <PageContainer>
            <div className="max-w-4xl mx-auto py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-4">GitRapid Plans</h1>
                    <p className="text-lg text-gray-600">Choose the perfect plan for your needs</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Monthly Plan */}
                    <div className="border rounded-lg p-8 hover:shadow-lg transition-shadow">
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
                            <Button onClick={() => handleCheckout('monthly')} className="w-full">
                                Subscribe Monthly
                            </Button>
                        ) : (
                            <Button onClick={() => (window.location.href = '/')} className="w-full">
                                Log in to subscribe
                            </Button>
                        )}
                    </div>

                    {/* Yearly Plan */}
                    <div className="border rounded-lg p-8 hover:shadow-lg transition-shadow border-blue-500 relative">
                        <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            SAVE 17%
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Yearly Plan</h2>
                        <p className="text-gray-600 mb-4">Best value for power users</p>
                        <div className="mb-6">
                            <span className="text-4xl font-bold">$89</span>
                            <span className="text-gray-600 ml-2">/year</span>
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
                            <Button
                                onClick={() => handleCheckout('yearly')}
                                className="w-full bg-blue-500 hover:bg-blue-600"
                            >
                                Subscribe Yearly
                            </Button>
                        ) : (
                            <Button
                                onClick={() => (window.location.href = '/')}
                                className="w-full bg-blue-500 hover:bg-blue-600"
                            >
                                Log in to subscribe
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}
