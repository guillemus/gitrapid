import { FastLink, FastLink as Link } from '@/components/fastLink'
import { Badge } from '@/components/ui/badge'
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
                <div className="flex items-center space-x-6 overflow-x-auto overflow-y-hidden pb-0">
                    {tab === 'none' && <div className="py-2" />}
                    {tab !== 'none' && (
                        <>
                            <Tab
                                href={`/${owner}/${repo}`}
                                label="Code"
                                icon={Code}
                                active={tab === 'code'}
                            />
                            <Tab
                                href={`/${owner}/${repo}/issues`}
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
            className={`relative flex items-center space-x-2 px-1 text-sm font-medium whitespace-nowrap h-10 after:content-[''] after:absolute after:inset-x-0 after:bottom-[0px] after:h-[2px] after:rounded after:pointer-events-none ${
                props.active
                    ? 'text-foreground after:bg-orange-500'
                    : 'text-muted-foreground hover:text-foreground'
            }`}
        >
            <props.icon className="w-4 h-4" />
            <span className="leading-none">{props.label}</span>
            {props.count && (
                <Badge variant="secondary" className="ml-1 text-xs">
                    {props.count}
                </Badge>
            )}
        </Link>
    )
}
