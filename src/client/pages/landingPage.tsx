import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ArrowRight, Github, Search, Zap } from 'lucide-react'
import { useState } from 'react'

export function LandingPage() {
    let [ownerRepo, setOwnerRepo] = useState<string>('')

    function isValidOwnerRepo(value: string): boolean {
        let trimmed = value.trim()
        let pattern = /^[^\/\s]+\/[^\/\s]+$/
        return pattern.test(trimmed)
    }

    function handleOpen(): void {
        let trimmed = ownerRepo.trim()
        if (!isValidOwnerRepo(trimmed)) {
            return
        }
        window.location.href = `/${trimmed}`
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-3xl text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="p-2 bg-foreground rounded-lg">
                        <Zap className="h-6 w-6 text-background" />
                    </div>
                    <h1 className="text-3xl font-bold">gitrapid</h1>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                    Feels like home. Only faster.
                </h2>
                <p className="text-muted-foreground mt-4">
                    A familiar interface for your Git data with near‑instant navigation.
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

                <Card className="border bg-card mx-auto">
                    <CardContent className="py-6">
                        <div className="grid gap-4">
                            <div className="text-sm text-muted-foreground">
                                Open any public repo by owner/repo
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="owner/repo"
                                        className="pl-9"
                                        value={ownerRepo}
                                        onChange={(e) => setOwnerRepo(e.target.value)}
                                        aria-invalid={
                                            ownerRepo.length > 0 && !isValidOwnerRepo(ownerRepo)
                                        }
                                    />
                                </div>
                                <Button
                                    size="lg"
                                    onClick={handleOpen}
                                    disabled={!isValidOwnerRepo(ownerRepo)}
                                >
                                    Open
                                </Button>
                            </div>

                            <div className="text-sm text-muted-foreground mt-2">Or try one:</div>
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

                            <div className="text-xs text-muted-foreground mt-4">
                                Public demos are read‑only. Private repos stay private when you
                                connect.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
