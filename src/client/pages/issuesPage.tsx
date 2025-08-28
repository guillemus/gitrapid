import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    Plus,
    Search,
} from 'lucide-react'
import { Link } from 'react-router'
import { proxy, useSnapshot } from 'valtio'
import { formatRelativeTime, usePageQuery } from '../utils'

const labelColors: Record<string, string> = {
    bug: 'bg-red-100 text-red-800 border-red-200',
    enhancement: 'bg-blue-100 text-blue-800 border-blue-200',
    documentation: 'bg-green-100 text-green-800 border-green-200',
    'good first issue': 'bg-purple-100 text-purple-800 border-purple-200',
    nextjs: 'bg-gray-100 text-gray-800 border-gray-200',
    ui: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    typescript: 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

const pagination = proxy({
    cursors: [null as string | null],
    index: 0,
    pageSize: 15,
})

export function IssuesPage() {
    useSnapshot(pagination)

    let res = usePageQuery(api.public.issues.list, {
        owner: 'sst',
        repo: 'opencode',
        paginationOpts: {
            numItems: pagination.pageSize,
            cursor: pagination.cursors[pagination.index] ?? null,
        },
    })

    let issues = res?.page ?? []

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2.5">
                <div className="flex flex-1 items-center space-x-2.5">
                    <div className="relative flex-1">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                        <Input placeholder="Search issues" className="pl-10 font-normal" />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2 bg-transparent">
                                Labels
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>bug</DropdownMenuItem>
                            <DropdownMenuItem>enhancement</DropdownMenuItem>
                            <DropdownMenuItem>documentation</DropdownMenuItem>
                            <DropdownMenuItem>good first issue</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2 bg-transparent">
                                Milestones
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>v1.0.0</DropdownMenuItem>
                            <DropdownMenuItem>v1.1.0</DropdownMenuItem>
                            <DropdownMenuItem>v2.0.0</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New issue
                </Button>
            </div>

            {/* Filters and Search */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button size="sm" className="gap-2">
                        <AlertCircle className="h-4 w-4" />
                        XXX Open
                    </Button>
                    <Button size="sm" className="gap-2">
                        <CheckCircle className="h-4 w-4" />
                        XXX Closed
                    </Button>
                </div>

                <div className="flex items-center space-x-2">
                    <DropdownMenu>
                        <DropdownMenuContent>
                            <DropdownMenuItem>johndoe</DropdownMenuItem>
                            <DropdownMenuItem>janedoe</DropdownMenuItem>
                            <DropdownMenuItem>contributor</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuContent>
                            <DropdownMenuItem>bug</DropdownMenuItem>
                            <DropdownMenuItem>enhancement</DropdownMenuItem>
                            <DropdownMenuItem>documentation</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Frontend Redesign</DropdownMenuItem>
                            <DropdownMenuItem>API v2</DropdownMenuItem>
                            <DropdownMenuItem>Documentation</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuContent>
                            <DropdownMenuItem>v1.0.0</DropdownMenuItem>
                            <DropdownMenuItem>v1.1.0</DropdownMenuItem>
                            <DropdownMenuItem>v2.0.0</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuContent>
                            <DropdownMenuItem>johndoe</DropdownMenuItem>
                            <DropdownMenuItem>janedoe</DropdownMenuItem>
                            <DropdownMenuItem>contributor</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Bug</DropdownMenuItem>
                            <DropdownMenuItem>Feature</DropdownMenuItem>
                            <DropdownMenuItem>Documentation</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                                Newest
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Newest</DropdownMenuItem>
                            <DropdownMenuItem>Oldest</DropdownMenuItem>
                            <DropdownMenuItem>Most commented</DropdownMenuItem>
                            <DropdownMenuItem>Least commented</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Issues List */}
            <Card className="py-0">
                <CardContent className="p-0">
                    {issues.length === 0 ? (
                        <div className="text-muted-foreground p-8 text-center">
                            <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                            <p>No issues found matching your criteria.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {issues.map((issue) => (
                                <IssueItem key={issue._id} issue={issue} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            <PaginationControls />
        </div>
    )
}

function IssueItem({ issue }: { issue: Doc<'issues'> }) {
    return (
        <div className="hover:bg-muted/50 p-4 py-2 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex flex-1 items-start space-x-3">
                    <div className="mt-1">
                        {issue.state === 'open' ? (
                            <AlertCircle className="h-5 w-5 text-green-600" />
                        ) : (
                            <CheckCircle className="h-5 w-5 text-purple-600" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 leading-[1.4rem]">
                            <Link to={`/issues/${issue._id}`}>
                                <h3 className="text-foreground cursor-pointer font-medium hover:text-blue-600">
                                    {issue.title}
                                </h3>
                            </Link>
                            {issue.labels && issue.labels.length > 0 && (
                                <>
                                    {issue.labels.map((label) => (
                                        <Badge
                                            key={label}
                                            variant="outline"
                                            className={`text-xs ${labelColors[label] || 'border-gray-200 bg-gray-100 text-gray-800'}`}
                                        >
                                            {label}
                                        </Badge>
                                    ))}
                                </>
                            )}
                        </div>
                        <div className="text-muted-foreground mt-0 flex items-center space-x-1 text-xs font-normal">
                            <span>#{issue.number}</span>
                            <span>•</span>
                            <span>{issue.author.login}</span>
                            <span>opened {formatRelativeTime(issue.createdAt)}</span>
                        </div>
                    </div>
                </div>
                {(issue.comments ?? 0) > 0 && (
                    <div className="text-muted-foreground ml-4 flex w-16 items-center justify-start text-sm">
                        <MessageCircle className="h-4 w-4" />
                        <span className="ml-1 font-normal">{issue.comments}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function PaginationControls() {
    let res = usePageQuery(api.public.issues.list, {
        owner: 'sst',
        repo: 'opencode',
        paginationOpts: {
            numItems: pagination.pageSize,
            cursor: pagination.cursors[pagination.index] ?? null,
        },
    })

    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => {
                    if (pagination.index > 0) {
                        pagination.index = pagination.index - 1
                    }
                }}
                disabled={pagination.index === 0}
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => {
                    if (!res?.isDone && res?.continueCursor) {
                        let next = res.continueCursor
                        let nextStack = pagination.cursors.slice(0, pagination.index + 1)
                        nextStack.push(next)
                        pagination.cursors = nextStack
                        pagination.index = pagination.index + 1
                    }
                }}
                disabled={!!res?.isDone}
            >
                Next
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}
