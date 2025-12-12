import { LoginButton } from '@/components/login-button'

export function Landing() {
    return (
        <div className="min-h-screen bg-linear-to-b from-zinc-50 to-white">
            <div className="mx-auto max-w-xl px-6 py-16">
                <div className="rounded-md border border-zinc-200 bg-white p-6 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-3">
                        <img
                            src="/logo.png"
                            width={40}
                            height={40}
                            alt="GitRapid logo"
                            className="h-10 w-10 rounded-md"
                        />
                        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
                            GitRapid
                        </h1>
                    </div>

                    <p className="mt-3 text-lg text-zinc-600">A faster, open-source GitHub UI.</p>

                    <div className="mt-6 w-40 m-auto">
                        <LoginButton />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
                        <a
                            href="https://github.com/guillemus/gitrapid"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100"
                        >
                            GitHub repo
                        </a>
                        <a
                            href="/pricing"
                            className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100"
                        >
                            Pricing
                        </a>
                    </div>

                    <div className="mt-4 text-sm text-zinc-600">
                        <div>Free: up to 10 repos. Pro: $8/month.</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
