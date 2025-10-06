import { useLogout } from '@/client/queryClient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MarkGithubIcon as Github } from '@primer/octicons-react'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { Code, GitPullRequest, Settings } from 'lucide-react'

export function Header() {
    let isIssues = useRouterState({
        select: (state) => state.location.pathname.includes('/issues'),
    })

    let { owner, repo } = useParams({ strict: false })
    let logout = useLogout()

    return (
        <div className="bg-background border-b">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between pt-4 pb-0 font-normal">
                    <div className="flex items-center space-x-2">
                        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                            <Link to="/dash">
                                <Code className="h-4 w-4" />
                            </Link>
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Open menu">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link to="/settings">Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={(e) => {
                                        e.preventDefault()
                                        void logout()
                                    }}
                                >
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <div className="flex items-center justify-between space-x-6 overflow-x-auto overflow-y-hidden pb-0">
                    <div>
                        {!isIssues && <div className="py-2" />}
                        {isIssues && (
                            <>
                                <Tab
                                    href={`/${owner}/${repo}/issues`}
                                    label="Issues"
                                    active
                                    icon={GitPullRequest}
                                />
                            </>
                        )}
                    </div>

                    <div>{owner && repo && <SeeOnGitHubTab />}</div>
                </div>
            </div>
        </div>
    )
}

function SeeOnGitHubTab() {
    let path = window.location.pathname

    return <Tab openNewTab href={`https://github.com${path}`} label="See on GitHub" icon={Github} />
}

function Tab(props: {
    href: string
    openNewTab?: boolean
    active?: boolean
    label: string
    count?: number
    icon: React.ComponentType<{ className?: string }>
}) {
    return (
        <Link
            to={props.href}
            {...(props.openNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
