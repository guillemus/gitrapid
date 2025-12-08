import { PrefetchLink } from '@/components/prefetch-link'
import { ReactNode } from 'react'

function RepoNavLink(props: {
    to: '/$owner/$repo' | '/$owner/$repo/issues' | '/$owner/$repo/pulls'
    params: { owner: string; repo: string }
    icon: ReactNode
    label: string
    badge?: ReactNode
    isActive: boolean
}) {
    return (
        <div
            className={`flex flex-col justify-center h-12 border-b-2 ${props.isActive ? 'border-orange-500' : 'border-transparent'}`}
        >
            <PrefetchLink
                to={props.to}
                params={props.params}
                className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-200 transition-colors font-medium ${props.isActive ? 'font-bold' : 'font-normal'}`}
            >
                {props.icon}
                <span className="text-sm">{props.label}</span>
                {props.badge}
            </PrefetchLink>
        </div>
    )
}

export { RepoNavLink }
