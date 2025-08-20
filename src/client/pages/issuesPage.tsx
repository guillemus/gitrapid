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
import { AlertCircle, CheckCircle, ChevronDown, MessageCircle, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

const issues = [
    {
        id: 1,
        title: 'Add support for custom themes',
        state: 'open',
        author: 'johndoe',
        createdAt: '2 days ago',
        comments: 5,
        labels: ['enhancement', 'good first issue'],
    },
    {
        id: 2,
        title: 'Button component not working with Next.js 14',
        state: 'open',
        author: 'janedoe',
        createdAt: '1 day ago',
        comments: 12,
        labels: ['bug', 'nextjs'],
    },
    {
        id: 3,
        title: 'Documentation update for installation',
        state: 'closed',
        author: 'contributor',
        createdAt: '3 days ago',
        comments: 3,
        labels: ['documentation'],
    },
    {
        id: 4,
        title: 'Add dark mode toggle component',
        state: 'open',
        author: 'designer',
        createdAt: '5 days ago',
        comments: 8,
        labels: ['enhancement', 'ui'],
    },
    {
        id: 5,
        title: 'TypeScript errors in form components',
        state: 'open',
        author: 'developer',
        createdAt: '1 week ago',
        comments: 15,
        labels: ['bug', 'typescript'],
    },
]

const labelColors: Record<string, string> = {
    bug: 'bg-red-100 text-red-800 border-red-200',
    enhancement: 'bg-blue-100 text-blue-800 border-blue-200',
    documentation: 'bg-green-100 text-green-800 border-green-200',
    'good first issue': 'bg-purple-100 text-purple-800 border-purple-200',
    nextjs: 'bg-gray-100 text-gray-800 border-gray-200',
    ui: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    typescript: 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

export function IssuesPage() {
    const [filter, setFilter] = useState('open')
    const [searchQuery, setSearchQuery] = useState('')

    const filteredIssues = issues.filter((issue) => {
        const matchesFilter = filter === 'all' || issue.state === filter
        const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesFilter && matchesSearch
    })

    const openCount = issues.filter((issue) => issue.state === 'open').length
    const closedCount = issues.filter((issue) => issue.state === 'closed').length

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center flex-1 space-x-2.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="is:issue state:open"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 font-normal"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2 bg-transparent">
                                Labels
                                <ChevronDown className="w-4 h-4" />
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
                                <ChevronDown className="w-4 h-4" />
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
                    <Plus className="w-4 h-4" />
                    New issue
                </Button>
            </div>

            {/* Filters and Search */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button
                        variant={filter === 'open' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('open')}
                        className="gap-2"
                    >
                        <AlertCircle className="w-4 h-4" />
                        {openCount} Open
                    </Button>
                    <Button
                        variant={filter === 'closed' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('closed')}
                        className="gap-2"
                    >
                        <CheckCircle className="w-4 h-4" />
                        {closedCount} Closed
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
                                <ChevronDown className="w-4 h-4" />
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
            <Card>
                <CardContent className="p-0">
                    {filteredIssues.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No issues found matching your criteria.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredIssues.map((issue, index) => (
                                <div
                                    key={issue.id}
                                    className="p-4 hover:bg-muted/50 transition-colors py-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start space-x-3 flex-1">
                                            <div className="mt-1">
                                                {issue.state === 'open' ? (
                                                    <AlertCircle className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <CheckCircle className="w-5 h-5 text-purple-600" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap leading-[1.4rem]">
                                                    <Link to={`/issues/${issue.id}`}>
                                                        <h3 className="font-medium text-foreground hover:text-blue-600 cursor-pointer">
                                                            {issue.title}
                                                        </h3>
                                                    </Link>
                                                    {issue.labels.length > 0 && (
                                                        <>
                                                            {issue.labels.map((label) => (
                                                                <Badge
                                                                    key={label}
                                                                    variant="outline"
                                                                    className={`text-xs ${labelColors[label] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                                                                >
                                                                    {label}
                                                                </Badge>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center text-muted-foreground font-normal text-xs mt-0 space-x-1">
                                                    <span>#{issue.id}</span>
                                                    <span>•</span>
                                                    <span>{issue.author}</span>
                                                    <span>opened {issue.createdAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {issue.comments > 0 && (
                                            <div className="flex items-center text-sm text-muted-foreground ml-4 w-16 justify-start">
                                                <MessageCircle className="w-4 h-4" />
                                                <span className="font-normal ml-1">
                                                    {issue.comments}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
