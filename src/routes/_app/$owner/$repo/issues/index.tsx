import { qcMem, qcPersistent } from '@/client/queryClient'
import { formatRelativeTime, useMutable, usePageQuery, useTanstackQuery } from '@/client/utils'
import { GhLabel, GhUser } from '@/components/github'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { IssueOpenedIcon } from '@primer/octicons-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    Plus,
    Search,
    X,
} from 'lucide-react'
import { proxy, useSnapshot } from 'valtio'

export const Route = createFileRoute('/_app/$owner/$repo/issues/')({
    loader: async (ctx) => {
        void qcPersistent.prefetchQuery(
            convexQuery(api.public.issues.list, {
                owner: ctx.params.owner,
                repo: ctx.params.repo,
                state: state.filters.state,
                sortBy: state.filters.sortBy,
                paginationOpts: {
                    numItems: state.pageSize,
                    cursor: null,
                },
            }),
        )
    },
    component: IssuesPage,
})

const state = proxy({
    cursors: [null] as (string | null)[],
    index: 0,
    pageSize: 20,
    filters: {
        search: '',
        state: 'open' as 'open' | 'closed',
        sortBy: 'createdAt' as 'createdAt' | 'updatedAt' | 'comments',
    },
})

type IssuesListResult = FunctionReturnType<typeof api.public.issues.list>
type SearchResult = FunctionReturnType<typeof api.public.issues.search>

type FoundIssue = SearchResult['issues'][number]

function IssuesPage() {
    let navigate = Route.useNavigate()
    let params = Route.useParams()
    useSnapshot(state)

    let activeSearch = state.filters.search

    let issueList = usePageQuery(
        api.public.issues.list,
        {
            owner: params.owner,
            repo: params.repo,
            state: state.filters.state,
            sortBy: state.filters.sortBy,
            paginationOpts: {
                numItems: state.pageSize,
                cursor: state.cursors[state.index] ?? null,
            },
        },
        qcMem,
    )

    let queryArgs = activeSearch
        ? { owner: params.owner, repo: params.repo, search: activeSearch }
        : ('skip' as const)

    // When searching, fetch unified search set (up to 200) and paginate client-side
    let searchQuery = useTanstackQuery(convexQuery(api.public.issues.search, queryArgs))

    let repo = issueList?.repo
    let issues: FoundIssue[] = []
    let isSearchLoading = !!activeSearch && (searchQuery.isLoading || searchQuery.isFetching)

    if (activeSearch) {
        if (!isSearchLoading) {
            let all = searchQuery.data?.issues ?? []
            // Filter by state client-side
            let filtered = all.filter((i) => i.state === state.filters.state)
            // Sort client-side
            if (state.filters.sortBy === 'createdAt') {
                filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            } else if (state.filters.sortBy === 'updatedAt') {
                filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            } else {
                filtered.sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0))
            }
            // Client-side pagination
            let start = state.index * state.pageSize
            issues = filtered.slice(start, start + state.pageSize)
        }
    } else {
        issues = issueList?.page ?? []
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2.5">
                <SearchBar />
                <Button
                    className="gap-2"
                    onClick={() =>
                        navigate({
                            to: `/$owner/$repo/issues/new`,
                            params: { owner: params.owner, repo: params.repo },
                        })
                    }
                >
                    <Plus className="h-4 w-4" />
                    New issue
                </Button>
            </div>

            {/* Filters and Search */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button
                        size="sm"
                        className="gap-2"
                        variant={state.filters.state === 'open' ? 'default' : 'outline'}
                        onClick={() => {
                            state.filters.state = state.filters.state === 'open' ? 'closed' : 'open'
                            state.cursors = [null]
                            state.index = 0
                        }}
                    >
                        <AlertCircle className="h-4 w-4" />
                        {isSearchLoading
                            ? '... Open'
                            : activeSearch
                              ? (() => {
                                    let meta = searchQuery.data?.meta
                                    let count = meta?.totalOpen ?? 0
                                    return `${count} Open`
                                })()
                              : repo
                                ? `${repo.openIssues} Open`
                                : '... Open'}
                    </Button>
                    <Button
                        size="sm"
                        className="gap-2"
                        variant={state.filters.state === 'closed' ? 'default' : 'outline'}
                        onClick={() => {
                            state.filters.state =
                                state.filters.state === 'closed' ? 'open' : 'closed'
                            state.cursors = [null]
                            state.index = 0
                        }}
                    >
                        <CheckCircle className="h-4 w-4" />
                        {isSearchLoading
                            ? '... Closed'
                            : activeSearch
                              ? (() => {
                                    let meta = searchQuery.data?.meta
                                    let count = meta?.totalClosed ?? 0
                                    return `${count} Closed`
                                })()
                              : repo
                                ? `${repo.closedIssues} Closed`
                                : '... Closed'}
                    </Button>
                </div>

                <div className="flex items-center space-x-2">
                    <SortByDropdown></SortByDropdown>
                </div>
            </div>

            {/* Issues List */}
            <Card className="py-0">
                <CardContent className="p-0">
                    {isSearchLoading || !issueList ? (
                        <LoadingList />
                    ) : issues.length === 0 ? (
                        <div className="text-muted-foreground p-8 text-center">
                            <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                            <p>No issues found matching your criteria.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {issues.map((issue) => (
                                <IssueItem
                                    key={issue._id}
                                    issue={issue}
                                    sortBy={state.filters.sortBy}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <PaginationControls />
        </div>
    )
}

function IssueItem(props: { issue: FoundIssue; sortBy: 'createdAt' | 'updatedAt' | 'comments' }) {
    let params = Route.useParams()

    return (
        <div
            className="hover:bg-muted/50 p-4 py-2 transition-colors"
            onMouseDown={() => {
                return qcPersistent.prefetchQuery(
                    convexQuery(api.public.issues.get, {
                        owner: params.owner,
                        repo: params.repo,
                        number: props.issue.number,
                    }),
                )
            }}
        >
            <div className="flex items-center justify-between">
                <div className="flex flex-1 items-start space-x-3">
                    <div className="mt-1">
                        {props.issue.state === 'open' ? (
                            <IssueOpenedIcon className="h-4 w-4 text-green-600" />
                        ) : (
                            <CheckCircle className="h-5 w-5 text-purple-600" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 leading-[1.4rem]">
                            <Link
                                to={`/$owner/$repo/issues/$issue`}
                                params={{
                                    owner: params.owner,
                                    repo: params.repo,
                                    issue: props.issue.number,
                                }}
                            >
                                <h3 className="text-foreground cursor-pointer font-medium hover:text-blue-600">
                                    {props.issue.title}
                                </h3>
                            </Link>
                            {props.issue.labels.map((label) => (
                                <GhLabel key={label._id} label={label} />
                            ))}
                        </div>
                        <div className="text-muted-foreground mt-0 flex items-center space-x-1 text-xs font-normal">
                            <span>#{props.issue.number}</span>
                            <span>•</span>
                            <GhUser hideAvatar user={props.issue.author}></GhUser>
                            <span>opened {formatRelativeTime(props.issue.createdAt)}</span>
                            {props.sortBy === 'updatedAt' && (
                                <>
                                    <span>•</span>
                                    <span>updated {formatRelativeTime(props.issue.updatedAt)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {(props.issue.comments ?? 0) > 0 && (
                    <div className="text-muted-foreground ml-4 flex w-16 items-center justify-start text-sm">
                        <MessageCircle className="h-4 w-4" />
                        <span className="ml-1 font-normal">{props.issue.comments}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function PaginationControls() {
    let hasSearch = !!state.filters.search

    if (hasSearch) return <ClientPaginationControls />
    return <ServerPaginationControls />
}

// Paginates issues by cursor
function ServerPaginationControls() {
    let params = Route.useParams()
    let res: IssuesListResult | null | undefined = usePageQuery(api.public.issues.list, {
        owner: params.owner,
        repo: params.repo,
        state: state.filters.state,
        sortBy: state.filters.sortBy,
        paginationOpts: {
            numItems: state.pageSize,
            cursor: state.cursors[state.index] ?? null,
        },
    })

    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => {
                    if (state.index > 0) {
                        state.index = state.index - 1
                    }
                }}
                disabled={state.index === 0}
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => {
                    let canPage = res?.isDone === false
                    let next = res?.continueCursor
                    if (canPage && next) {
                        let nextStack = state.cursors.slice(0, state.index + 1)
                        nextStack.push(next)
                        state.cursors = nextStack
                        state.index = state.index + 1
                    }
                }}
                disabled={res?.isDone ?? true}
            >
                Next
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

// Paginates already fetched issues
function ClientPaginationControls() {
    let params = Route.useParams()
    let searchRes = useTanstackQuery(
        convexQuery(
            api.public.issues.search,
            state.filters.search
                ? { owner: params.owner, repo: params.repo, search: state.filters.search }
                : 'skip',
        ),
    )
    let loading = searchRes.isLoading || searchRes.isFetching
    let total = loading ? 0 : ((searchRes.data?.issues?.length as number | undefined) ?? 0)
    let pageCount = Math.ceil(total / state.pageSize)
    let atStart = state.index === 0
    let atEnd = pageCount === 0 || state.index >= pageCount - 1

    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => {
                    if (!atStart) state.index = state.index - 1
                }}
                disabled={atStart || loading}
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => {
                    if (!atEnd) state.index = state.index + 1
                }}
                disabled={atEnd || loading}
            >
                {loading ? 'Loading…' : 'Next'}
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

function LoadingList() {
    return (
        <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 py-2">
                    <div className="animate-pulse">
                        <div className="bg-muted mb-2 h-4 w-1/3 rounded" />
                        <div className="bg-muted h-3 w-2/3 rounded" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function SortByDropdown() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    {(() => {
                        if (state.filters.sortBy === 'createdAt') {
                            return 'Newest'
                        }
                        if (state.filters.sortBy === 'updatedAt') {
                            return 'Last updated'
                        }
                        return 'Total comments'
                    })()}
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    onClick={() => {
                        state.filters.sortBy = 'createdAt'
                        state.cursors = [null]
                        state.index = 0
                    }}
                >
                    Newest
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        state.filters.sortBy = 'updatedAt'
                        state.cursors = [null]
                        state.index = 0
                    }}
                >
                    Last updated
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        state.filters.sortBy = 'comments'
                        state.cursors = [null]
                        state.index = 0
                    }}
                >
                    Total comments
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function SearchBar() {
    let searchInput = useMutable({ value: '' })

    return (
        <div className="flex flex-1 items-center space-x-0">
            <div className="relative flex-1">
                <Input
                    autoFocus
                    placeholder="Search issues by title"
                    className="rounded-r-none pr-10 font-normal"
                    value={searchInput.value}
                    onChange={(e) => {
                        searchInput.value = e.target.value
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            state.filters.search = searchInput.value.trim()
                            state.cursors = [null]
                            state.index = 0
                        }
                    }}
                />
                <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                        searchInput.value = ''
                    }}
                    className={`text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 transition-colors ${
                        searchInput.value.length === 0 ? 'hidden' : ''
                    }`}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="-ml-px h-10 gap-2 rounded-l-none bg-transparent"
                onClick={() => {
                    state.filters.search = searchInput.value.trim()
                    state.cursors = [null]
                    state.index = 0
                }}
                aria-label="Search"
            >
                <Search className="h-4 w-4" />
            </Button>
        </div>
    )
}
