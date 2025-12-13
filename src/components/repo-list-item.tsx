import { PrefetchLink } from '@/components/prefetch-link'
import type { Repository } from '@/server/router'
import { StarIcon } from '@primer/octicons-react'

export function RepoListItem(props: { repo: Repository }) {
    const formatStars = (count: number) => {
        return count.toLocaleString()
    }

    return (
        <PrefetchLink
            to="/$owner/$repo"
            params={{ owner: props.repo.owner.login, repo: props.repo.name }}
            className="block p-3 hover:bg-accent border-b border-border last:border-b-0"
        >
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate text-foreground">
                            {props.repo.name}
                        </span>
                        {props.repo.language && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                {props.repo.language}
                            </span>
                        )}
                    </div>
                    {props.repo.description && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                            {props.repo.description}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0 text-sm text-muted-foreground">
                    <span>{formatStars(props.repo.stargazers_count)}</span>
                    <StarIcon size={14} />
                </div>
            </div>
        </PrefetchLink>
    )
}
