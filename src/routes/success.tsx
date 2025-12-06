import { PageContainer } from '@/components/page-container'
import { Button } from '@/components/ui/button'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/success')({
    component: SuccessPage,
})

function SuccessPage() {
    const navigate = useNavigate()

    return (
        <PageContainer>
            <div className="max-w-2xl mx-auto py-12 text-center">
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
            </div>
        </PageContainer>
    )
}
