import { PrefetchLink } from '@/components/prefetch-link'
import type { Repository } from '@/server/router'
import { StarIcon } from '@primer/octicons-react'

export function RepoListItem(props: { repo: Repository }) {
    const formatStars = (count: number) => {
        return count.toLocaleString()
    }

    return (
        <PrefetchLink
            to="/$owner/$repo/pulls"
            params={{ owner: props.repo.owner.login, repo: props.repo.name }}
            className="block p-3 hover:bg-zinc-50 border-b border-zinc-200 last:border-b-0"
        >
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate text-zinc-900">
                            {props.repo.name}
                        </span>
                        {props.repo.language && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                                {props.repo.language}
                            </span>
                        )}
                    </div>
                    {props.repo.description && (
                        <div className="text-sm text-zinc-600 line-clamp-2">
                            {props.repo.description}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0 text-sm text-zinc-500">
                    <span>{formatStars(props.repo.stargazers_count)}</span>
                    <StarIcon size={14} />
                </div>
            </div>
        </PrefetchLink>
    )
}
