import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { githubClient } from './lib/github-client'
import { useNavigate } from 'react-router'
import { unwrap, useClickOutside, useDebounce, useGithubFilePath } from './lib/utils'

type CodeSearchBarProps = {
    owner: string
    repo: string
}

export function CodeSearchBar(props: CodeSearchBarProps) {
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)

    const debouncedQuery = useDebounce(query, 300)
    const navigate = useNavigate()
    const params = useGithubFilePath()

    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search-code', debouncedQuery, props.owner, props.repo],
        queryFn: () => {
            console.log('searching')
            return githubClient
                .searchCode(debouncedQuery, props.owner, props.repo, undefined, undefined, 10)
                .then(unwrap)
        },
        enabled: debouncedQuery.length > 2,
        staleTime: 30000,
    })

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setQuery(value)
        setIsOpen(value.length > 2)
    }, [])

    function handleFileSelect(filePath: string) {
        navigate(`/${props.owner}/${props.repo}/tree/${params.ref}/${filePath}`)
        setIsOpen(false)
        setQuery('')
    }

    const containerRef = useClickOutside(() => setIsOpen(false))

    return (
        <div ref={containerRef} className="relative w-lg">
            <input
                type="text"
                placeholder="Search code..."
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

                    {searchResults?.items?.map((item) => (
                        <button
                            key={`${item.path}-${item.sha}`}
                            onClick={() => handleFileSelect(item.path)}
                            className="hover:bg-base-200 border-base-300 w-full border-b p-3 text-left last:border-b-0"
                        >
                            <div className="text-sm font-medium">{item.name}</div>
                            <div className="text-base-content/70 text-xs">{item.path}</div>
                            {item.text_matches?.[0] && (
                                <div className="text-base-content/50 mt-1 font-mono text-xs">
                                    {item.text_matches[0].fragment}
                                </div>
                            )}
                        </button>
                    ))}

                    {searchResults?.items?.length === 0 && (
                        <div className="text-base-content/70 p-4 text-center">
                            No code matches found
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
