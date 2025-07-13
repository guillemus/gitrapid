import { authClient, getLanguageFromExtension, useGithubFilePath } from '@/client/utils'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { CodeBlockWithParsing } from './code-block'
import { BreadcrumbsWithGitHubLink, FastNavlink } from './components'
import { SignInButton } from './login'
import { searchCodeOptions } from './queryOptions'

function Search() {
    const { data } = authClient.useSession()
    const { owner, repo } = useGithubFilePath()
    const [searchParams] = useSearchParams()
    const query = searchParams.get('q') || ''

    const isSignedIn = !!data?.user.email

    const {
        data: results,
        isLoading,
        error,
    } = useQuery(searchCodeOptions(owner, repo, query, isSignedIn))

    if (!isSignedIn) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="alert alert-info flex flex-col">
                    <span>Please sign in to search GitHub repositories</span>

                    <SignInButton></SignInButton>
                </div>
            </div>
        )
    }

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

    if (!results || results.total_count === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-gray-500">{`No results found for "${query}"}`}</p>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Search Results</h1>
                <p className="text-gray-600">
                    {`${results.total_count} results for "${query}" in ${owner}/${repo}`}
                </p>
            </div>

            <div className="space-y-6">
                {results.items.map((item, index) => (
                    <div key={index} className="card bg-base-100 shadow-sm">
                        <div className="card-body">
                            <h2 className="card-title text-lg">
                                <FastNavlink
                                    to={item.html_url.replace('https://github.com', '')}
                                    className="link link-primary"
                                >
                                    {item.path}
                                </FastNavlink>
                            </h2>

                            {item.text_matches?.map((match, matchIndex) => {
                                const language = getLanguageFromExtension(item.path)

                                const highlightRanges =
                                    match.matches?.map((submatch) => ({
                                        start: submatch.indices?.[0] || 0,
                                        end: submatch.indices?.[1] || 0,
                                    })) || []

                                return (
                                    <div
                                        key={matchIndex}
                                        className="mt-4 rounded border border-gray-200"
                                    >
                                        <CodeBlockWithParsing
                                            code={match.fragment || ''}
                                            language={language}
                                            highlightRanges={highlightRanges}
                                        />
                                    </div>
                                )
                            })}
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
