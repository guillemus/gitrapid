import { Button } from '@/components/ui/button'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { ArrowRight, Zap } from 'lucide-react'

export function LandingPage() {
    return (
        <div className="bg-background flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-3xl text-center">
                <div className="mb-4 flex items-center justify-center gap-2">
                    <div className="bg-foreground rounded-lg p-2">
                        <Zap className="text-background h-6 w-6" />
                    </div>
                    <h1 className="text-3xl font-bold">gitrapid</h1>
                </div>
                <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                    Feels like home. Only faster.
                </h2>
                <p className="text-muted-foreground mt-4">
                    A familiar interface for your Git data with near-instant navigation.
                </p>

                <div className="mt-6 flex items-center justify-center gap-3">
                    <Button asChild size="lg">
                        <a href="/facebook/react">
                            Browse a live repo
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <a href="/login">
                            <Github className="mr-2 h-4 w-4" />
                            Continue with GitHub
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    )
}
