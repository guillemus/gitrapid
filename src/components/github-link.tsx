import { useRouterState } from '@tanstack/react-router'
import { LinkExternalIcon } from '@primer/octicons-react'

export function GithubLink() {
    let routerState = useRouterState()
    let path = routerState.location.pathname
    return (
        <div className="flex flex-col justify-center h-12">
            <a
                href={`https://github.com${path}`}
                target="_blank"
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-200 transition-colors"
            >
                <LinkExternalIcon size={16} />
                <span className="text-sm">See on GitHub</span>
            </a>
        </div>
    )
}
