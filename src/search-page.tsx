import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { githubClient } from './lib/github-client'
import { BreadcrumbsWithGitHubLink } from './components'

function Search() {
    const { owner, repo } = useParams<{ owner: string; repo: string }>()
    const [searchParams] = useSearchParams()
    const query = searchParams.get('q') || ''

    const {
        data: searchResults,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['search-code', owner, repo, query],
        queryFn: () => {
            if (!owner || !repo || !query) return null
            return githubClient.searchCode(query, owner, repo)
        },
        enabled: Boolean(owner && repo && query),
    })

    if (!query) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-gray-500">Enter a search query to get started</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="alert alert-error">
                    <span>Failed to search: {error.message}</span>
                </div>
            </div>
        )
    }

    if (searchResults?.error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="alert alert-error">
                    <span>Search failed: {searchResults.error.message}</span>
                </div>
            </div>
        )
    }

    const results = searchResults?.data
    if (!results || results.total_count === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-gray-500">No results found for "{query}"</p>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Search Results</h1>
                <p className="text-gray-600">
                    {results.total_count} results for "{query}" in {owner}/{repo}
                </p>
            </div>

            <div className="space-y-6">
                {results.items.map((item, index) => (
                    <div key={index} className="card bg-base-100 shadow-sm">
                        <div className="card-body">
                            <h2 className="card-title text-lg">
                                <a
                                    href={item.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link link-primary"
                                >
                                    {item.path}
                                </a>
                            </h2>

                            {item.text_matches?.map((match, matchIndex) => (
                                <div key={matchIndex} className="mt-4">
                                    <div className="mockup-code text-sm">
                                        <pre className="px-4">
                                            <code>{match.fragment}</code>
                                        </pre>
                                    </div>
                                    {match.matches?.map((submatch, submatchIndex) => (
                                        <div
                                            key={submatchIndex}
                                            className="mt-2 text-sm text-gray-600"
                                        >
                                            Match at indices {submatch.indices?.join('-')}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function SearchPage() {
    return (
        <div className="flex h-full flex-col">
            <BreadcrumbsWithGitHubLink />
            <div className="flex-1 overflow-y-auto p-4">
                <Search></Search>
            </div>
        </div>
    )
}
