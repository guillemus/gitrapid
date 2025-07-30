export function LandingPage() {
    return (
        <div className="bg-base-200 flex min-h-screen items-center justify-center">
            <div className="hero-content text-center">
                <div className="max-w-md">
                    <h1 className="text-5xl font-bold">GitRapid</h1>
                    <p className="py-6">A faster github experience</p>
                    <div className="flex gap-4">
                        <a href="/alarbada/gitrapid.com" className="btn btn-primary">
                            alarbada/gitrapid.com
                        </a>
                        <a
                            href="/alarbada/gitrapid.com/blob/main/README.md"
                            className="btn btn-primary"
                        >
                            alarbada/gitrapid.com (commit)
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
