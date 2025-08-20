import { Badge } from '@/components/ui/badge'
import { FastLink, FastLink as Link } from '@/components/ui/link'
import { Code, GitPullRequest, Settings } from 'lucide-react'
import { useLocation, useParams } from 'react-router'
import { useLogout } from './convex'

export type HeaderProps = {
    tab: 'code' | 'issues' | 'none'
}

export function Header({ tab }: HeaderProps) {
    let { owner, repo } = useParams()

    const logout = useLogout()
    let path = useLocation().pathname

    return (
        <div className="border-b bg-background">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between pt-4 pb-0 font-normal">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <FastLink to="/dash">
                                <Code className="w-4 h-4" />
                            </FastLink>
                        </div>
                        {owner && repo && (
                            <>
                                <div className="flex items-center space-x-1">
                                    <Link
                                        to="#"
                                        className="text-blue-600 hover:underline font-medium"
                                    >
                                        {owner}
                                    </Link>
                                    <span className="text-muted-foreground">/</span>
                                    <Link
                                        to="#"
                                        className="text-blue-600 hover:underline font-bold"
                                    >
                                        {repo}
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        <Link
                            to="/settings"
                            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
                        >
                            <Settings className="w-5 h-5" />
                            <span>Settings</span>
                        </Link>
                    </div>
                </div>
                <div className="flex items-center space-x-6 overflow-x-auto pb-0">
                    {tab === 'none' && <div className="py-2" />}
                    {tab !== 'none' && (
                        <>
                            <Tab href="/" label="Code" icon={Code} active={tab === 'code'} />
                            <Tab
                                href="/issues"
                                label="Issues"
                                active={tab === 'issues'}
                                icon={GitPullRequest}
                                count={23}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function Tab(props: {
    href: string
    active?: boolean
    label: string
    count?: number
    icon: React.ComponentType<{ className?: string }>
}) {
    return (
        <Link
            to={props.href}
            className={`flex items-center space-x-2 px-1 text-sm font-medium whitespace-nowrap py-3 border-b-2 ${
                props.active
                    ? 'border-orange-500 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            }`}
        >
            <props.icon className="w-4 h-4" />
            <span>{props.label}</span>
            {props.count && (
                <Badge variant="secondary" className="ml-1 text-xs">
                    {props.count}
                </Badge>
            )}
        </Link>
    )
}
