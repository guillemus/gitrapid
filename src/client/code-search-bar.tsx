import { useMutable } from '@/client/utils'
import { useNavigate } from 'react-router'

type CodeSearchBarProps = {
    owner: string
    repo: string
}

export function CodeSearchBar(props: CodeSearchBarProps) {
    const query = useMutable({ value: '' })
    const navigate = useNavigate()

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        query.value = e.target.value
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' && query.value.trim()) {
            navigate(
                `/${props.owner}/${props.repo}/search?q=${encodeURIComponent(query.value.trim())}`,
            )
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (query.value.trim()) {
            navigate(
                `/${props.owner}/${props.repo}/search?q=${encodeURIComponent(query.value.trim())}`,
            )
        }
    }

    return (
        <form onSubmit={handleSubmit} className="w-lg">
            <input
                type="text"
                placeholder="Search code..."
                value={query.value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="input input-bordered w-full"
            />
        </form>
    )
}
