import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { githubClient } from './lib/github-client'

type SearchbarProps = {
    onRepoSelect: (owner: string, repo: string) => void
}

export function Searchbar(props: SearchbarProps) {
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)

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

    const handleRepoSelect = useCallback((owner: string, repo: string) => {
        props.onRepoSelect(owner, repo)
        setIsOpen(false)
        setQuery(`${owner}/${repo}`)
    }, [props])

    return (
        <div className="relative w-full max-w-md">
            <input
                type="text"
                placeholder="Search repositories..."
                value={query}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                onFocus={() => query.length > 2 && setIsOpen(true)}
            />
            
            {isOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {isLoading && (
                        <div className="p-4 text-center">
                            <span className="loading loading-spinner loading-sm"></span>
                        </div>
                    )}
                    
                    {searchResults?.items?.map((repo) => (
                        <button
                            key={repo.id}
                            onClick={() => handleRepoSelect(repo.owner?.login || '', repo.name)}
                            className="w-full p-3 text-left hover:bg-base-200 border-b border-base-300 last:border-b-0"
                        >
                            <div className="font-medium">{repo.full_name}</div>
                            <div className="text-sm text-base-content/70 truncate">
                                {repo.description}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-base-content/50 mt-1">
                                <span>⭐ {repo.stargazers_count}</span>
                                <span>🍴 {repo.forks_count}</span>
                                <span>{repo.language}</span>
                            </div>
                        </button>
                    ))}
                    
                    {searchResults?.items?.length === 0 && (
                        <div className="p-4 text-center text-base-content/70">
                            No repositories found
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
