import { HeaderWithTitle } from '@/components/header'
import { PageContainer } from '@/components/layouts'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { authClient } from '@/lib/auth-client'
import { demoRepos } from '@/lib/demo-repos'
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
                            <p className="text-muted-foreground mb-4">
                                Perfect for getting started
                            </p>
                            <div className="mb-6">
                                <span className="text-4xl font-bold">$8</span>
                                <span className="text-muted-foreground ml-2">/month</span>
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

                        <Separator className="my-8" />

                        <div>
                            <div className="text-sm font-medium text-foreground text-center">
                                Or try GitRapid for free on an example repo
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                                {demoRepos.map((demoRepo) => (
                                    <a
                                        key={`${demoRepo.owner}/${demoRepo.repo}`}
                                        href={`/${demoRepo.owner}/${demoRepo.repo}`}
                                        className="group block rounded-md px-3 py-3 text-left hover:bg-accent"
                                    >
                                        <div className="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 group-hover:decoration-foreground">
                                            {demoRepo.owner}/{demoRepo.repo}
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                            {demoRepo.description}
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </PageContainer>
            </div>
        </div>
    )
}
