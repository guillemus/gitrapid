import { useParams } from '@tanstack/react-router'
import { PageContainer } from './page-container'

export function ComingSoon() {
    let params = useParams({ strict: false })

    return (
        <PageContainer>
            <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-zinc-900 mb-4">Coming Soon</h2>
                    <p className="text-lg text-zinc-600 mb-8">
                        We're actively working on this feature. Check back soon!
                    </p>
                    {params.owner && params.repo && (
                        <a
                            href={`https://github.com/${params.owner}/${params.repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors font-medium"
                        >
                            View on GitHub
                        </a>
                    )}
                </div>
            </div>
        </PageContainer>
    )
}
