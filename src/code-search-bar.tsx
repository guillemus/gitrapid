import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'

type CodeSearchBarProps = {
    owner: string
    repo: string
}

export function CodeSearchBar(props: CodeSearchBarProps) {
    const [query, setQuery] = useState('')
    const navigate = useNavigate()

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value)
    }, [])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && query.trim()) {
                navigate(
                    `/${props.owner}/${props.repo}/search?q=${encodeURIComponent(query.trim())}`,
                )
            }
        },
        [query, navigate, props.owner, props.repo],
    )

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault()
            if (query.trim()) {
                navigate(
                    `/${props.owner}/${props.repo}/search?q=${encodeURIComponent(query.trim())}`,
                )
            }
        },
        [query, navigate, props.owner, props.repo],
    )

    return (
        <form onSubmit={handleSubmit} className="w-lg">
            <input
                type="text"
                placeholder="Search code..."
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="input input-bordered w-full"
            />
        </form>
    )
}
