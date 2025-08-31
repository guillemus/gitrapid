import { FastLink, FastLink as Link } from '@/components/fastLink'
import { Badge } from '@/components/ui/badge'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { Code, GitPullRequest, Settings } from 'lucide-react'
import { useParams } from 'react-router'

export type HeaderProps = {
    tab: 'issues' | 'none'
}

export function Header({ tab }: HeaderProps) {
    let { owner, repo } = useParams()

    return (
        <div className="bg-background border-b">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between pt-4 pb-0 font-normal">
                    <div className="flex items-center space-x-2">
                        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                            <FastLink to="/dash">
                                <Code className="h-4 w-4" />
                            </FastLink>
                        </div>
                        {owner && repo && (
                            <>
                                <div className="flex items-center space-x-1">
                                    {owner}

                                    <span className="text-muted-foreground">/</span>

                                    {repo}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        <Link
                            to="/settings"
                            className="text-muted-foreground hover:text-foreground flex items-center space-x-2"
                        >
                            <Settings className="h-5 w-5" />
                            <span>Settings</span>
                        </Link>
                    </div>
                </div>
                <div className="flex items-center justify-between space-x-6 overflow-x-auto overflow-y-hidden pb-0">
                    <div>
                        {tab === 'none' && <div className="py-2" />}
                        {tab !== 'none' && (
                            <>
                                <Tab
                                    href={`/${owner}/${repo}/issues`}
                                    label="Issues"
                                    active={tab === 'issues'}
                                    icon={GitPullRequest}
                                />
                            </>
                        )}
                    </div>

                    <div>
                        <SeeOnGitHubTab />
                    </div>
                </div>
            </div>
        </div>
    )
}

function SeeOnGitHubTab() {
    let path = window.location.pathname

    return <Tab href={`https://github.com${path}`} label="See on GitHub" icon={Github} />
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
            className={`relative flex h-10 items-center space-x-2 px-1 text-sm font-medium whitespace-nowrap after:pointer-events-none after:absolute after:inset-x-0 after:bottom-[0px] after:h-[2px] after:rounded after:content-[''] ${
                props.active
                    ? 'text-foreground after:bg-orange-500'
                    : 'text-muted-foreground hover:text-foreground'
            }`}
        >
            <props.icon className="h-4 w-4" />
            <span className="leading-none">{props.label}</span>
            {props.count && (
                <Badge variant="secondary" className="ml-1 text-xs">
                    {props.count}
                </Badge>
            )}
        </Link>
    )
}
