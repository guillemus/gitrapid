import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'

export function Landing(props: { children: React.ReactNode }) {
    return (
        <div className="bg-background flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-3xl text-center">
                <div className="mb-4 flex items-center justify-center gap-2">
                    <div className="bg-foreground rounded-lg p-2">
                        <Zap className="text-background h-6 w-6" />
                    </div>
                    <h1 className="relative text-3xl font-bold">
                        GitRapid
                        <Badge
                            variant="secondary"
                            className="absolute top-[-15px] right-[-27px] rotate-[10deg] bg-red-400 text-white"
                        >
                            alpha
                        </Badge>
                    </h1>
                </div>
                <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                    Just a github UI. Only way faster.
                </h2>
                <p className="text-muted-foreground mt-4">The fastest github ui on earth.</p>

                <div className="mt-6 flex items-center justify-center gap-3">{props.children}</div>
            </div>
        </div>
    )
}
