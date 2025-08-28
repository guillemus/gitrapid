import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { ArrowRight, Search, Zap } from 'lucide-react'
import { useState } from 'react'

export function LandingPage() {
    let [ownerRepo, setOwnerRepo] = useState<string>('')

    function handleOpen(): void {
        let trimmed = ownerRepo.trim()
        window.location.href = `/${trimmed}`
    }

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

                <Separator className="my-8" />

                <Card className="bg-card mx-auto border">
                    <CardContent className="py-6">
                        <div className="grid gap-4">
                            <div className="text-muted-foreground text-sm">
                                Open any public repo by owner/repo
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                        placeholder="owner/repo"
                                        className="pl-9"
                                        value={ownerRepo}
                                        onChange={(e) => setOwnerRepo(e.target.value)}
                                    />
                                </div>
                                <Button size="lg" onClick={handleOpen}>
                                    Open
                                </Button>
                            </div>

                            <div className="text-muted-foreground mt-2 text-sm">Or try one:</div>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button asChild variant="secondary">
                                    <a href="/facebook/react">facebook/react</a>
                                </Button>
                                <Button asChild variant="secondary">
                                    <a href="/vercel/next.js">vercel/next.js</a>
                                </Button>
                                <Button asChild variant="secondary">
                                    <a href="/microsoft/typescript">microsoft/typescript</a>
                                </Button>
                            </div>

                            <div className="text-muted-foreground mt-4 text-xs">
                                Public demos are read-only. Private repos stay private when you
                                connect.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
