import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { githubClient } from './lib/github-client'
import { useNavigate } from 'react-router'

export function Searchbar() {
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search-repos', query],
        queryFn: () => githubClient.searchRepos(query, 'stars', 'desc', 10),
        enabled: query.length > 2,
        staleTime: 30000,
    })

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setQuery(value)
        setIsOpen(value.length > 2)
    }, [])

    const navigate = useNavigate()

    function handleRepoSelect(owner: string, repo: string) {
        navigate(`/${owner}/${repo}`)
        setIsOpen(false)
        setQuery(`${owner}/${repo}`)
    }

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    return (
        <div ref={containerRef} className="relative w-full max-w-md">
            <input
                type="text"
                placeholder="Search repositories..."
                value={query}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                onFocus={() => query.length > 2 && setIsOpen(true)}
            />

            {isOpen && (
                <div className="bg-base-100 border-base-300 absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border shadow-lg">
                    {isLoading && (
                        <div className="p-4 text-center">
                            <span className="loading loading-spinner loading-sm"></span>
                        </div>
                    )}

                    {searchResults?.items?.map((repo) => (
                        <button
                            key={repo.id}
                            onClick={() => handleRepoSelect(repo.owner?.login || '', repo.name)}
                            className="hover:bg-base-200 border-base-300 w-full border-b p-3 text-left last:border-b-0"
                        >
                            <div className="font-medium">{repo.full_name}</div>
                            <div className="text-base-content/70 truncate text-sm">
                                {repo.description}
                            </div>
                            <div className="text-base-content/50 mt-1 flex items-center gap-2 text-xs">
                                <span>⭐ {repo.stargazers_count}</span>
                                <span>🍴 {repo.forks_count}</span>
                                <span>{repo.language}</span>
                            </div>
                        </button>
                    ))}

                    {searchResults?.items?.length === 0 && (
                        <div className="text-base-content/70 p-4 text-center">
                            No repositories found
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
