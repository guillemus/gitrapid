import { qcMem, qcPersistent } from '@/client/queryClient'
import { formatRelativeTime, useMutable, usePageQuery } from '@/client/utils'
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
import type { FunctionReturnType, PaginationResult } from 'convex/server'
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
import { z } from 'zod'

const search = z.object({
    state: z.enum(['open', 'closed']).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'comments']).optional(),
})

const PAGE_SIZE = 20

export const Route = createFileRoute('/_app/$owner/$repo/issues/')({
    validateSearch: search,
    loaderDeps: (s) => {
        return {
            filters: s.search,
            pageSize: PAGE_SIZE,
        }
    },
    loader: async (ctx) => {
        void qcMem.prefetchQuery(
            convexQuery(api.public.issues.list, {
                owner: ctx.params.owner,
                repo: ctx.params.repo,
                state: ctx.deps.filters.state ?? 'open',
                sortBy: ctx.deps.filters.sortBy,
                paginationOpts: {
                    numItems: PAGE_SIZE,
                    cursor: null,
                },
            }),
        )
    },
    component: IssuesPage,
})

class PaginationState {
    index = 0
    cursors: (string | null)[] = [null]

    resetCursors() {
        this.cursors = [null]
        this.index = 0
    }

    currCursor() {
        return this.cursors[this.index] ?? null
    }

    canGoPrev() {
        return this.index > 0
    }

    goToPrev() {
        if (this.index > 0) {
            this.index--
        }
    }

    canGoNext(pag?: PaginationResult<unknown>) {
        if (!pag) return false

        return !pag.isDone
    }

    goToNext(pag: PaginationResult<unknown>) {
        if (!this.canGoNext(pag)) return

        let nextCursor = pag.continueCursor

        this.index++
        if (this.currCursor() === null) {
            this.cursors.push(nextCursor)
            return
        }
    }
}

function useSearch() {
    let search = Route.useSearch()
    return {
        state: search.state ?? 'open',
        sortBy: search.sortBy ?? 'createdAt',
    }
}

type IssuesListResult = FunctionReturnType<typeof api.public.issues.list>

type FoundIssue = IssuesListResult['page'][number]

function IssuesPage() {
    let cursorState = useMutable(new PaginationState())

    let navigate = Route.useNavigate()
    let params = Route.useParams()
    let search = useSearch()

    let page = usePageQuery(
        api.public.issues.list,
        {
            owner: params.owner,
            repo: params.repo,
            state: search.state,
            sortBy: search.sortBy,
            paginationOpts: {
                numItems: PAGE_SIZE,
                cursor: cursorState.currCursor(),
            },
        },
        qcMem,
    )

    let repo = page?.repo
    let issues = page?.page ?? []

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <OpenIssuesButton cursorState={cursorState} totalIssues={repo?.openIssues} />
                    <ClosedIssuesButton
                        cursorState={cursorState}
                        totalIssues={repo?.closedIssues}
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <SortByDropdown cursorState={cursorState}></SortByDropdown>
                    <Button
                        size="sm"
                        className="gap-2"
                        onClick={async () =>
                            await navigate({
                                to: `/$owner/$repo/issues/new`,
                                params: { owner: params.owner, repo: params.repo },
                            })
                        }
                    >
                        <Plus className="h-4 w-4" />
                        New issue
                    </Button>
                </div>
            </div>

            <IssuesList loadingIssues={!page} issues={issues} />
            <PaginationControls cursorState={cursorState} page={page} />
        </div>
    )
}

// Paginates issues by cursor
function PaginationControls(props: {
    cursorState: PaginationState
    page?: PaginationResult<unknown>
}) {
    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => props.cursorState.goToPrev()}
                disabled={!props.cursorState.canGoPrev()}
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
            <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-transparent"
                onClick={() => props.page && props.cursorState.goToNext(props.page)}
                disabled={!props.cursorState.canGoNext(props.page)}
            >
                Next
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

function SortByDropdown(props: { cursorState: PaginationState }) {
    let navigate = Route.useNavigate()
    let search = useSearch()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    {(() => {
                        if (search.sortBy === 'createdAt') {
                            return 'Newest'
                        }
                        if (search.sortBy === 'updatedAt') {
                            return 'Last updated'
                        }
                        return 'Total comments'
                    })()}
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    onClick={async () => {
                        props.cursorState.resetCursors()
                        await navigate({
                            to: `/$owner/$repo/issues`,
                            search: (p) => ({ ...p, sortBy: 'createdAt' }),
                        })
                    }}
                >
                    Newest
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={async () => {
                        props.cursorState.resetCursors()
                        await navigate({
                            to: `/$owner/$repo/issues`,
                            search: (p) => ({ ...p, sortBy: 'updatedAt' }),
                        })
                    }}
                >
                    Last updated
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={async () => {
                        props.cursorState.resetCursors()
                        await navigate({
                            to: `/$owner/$repo/issues`,
                            search: (p) => ({ ...p, sortBy: 'comments' }),
                        })
                    }}
                >
                    Total comments
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function _SearchBar(props: { cursorState: PaginationState }) {
    let searchInput = useMutable({ value: '' })
    let navigate = Route.useNavigate()

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
                    onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                            props.cursorState.resetCursors()

                            await navigate({
                                to: `/$owner/$repo/issues`,
                                search: (p) => ({ ...p, search: searchInput.value }),
                            })
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
                className="-ml-px gap-2 rounded-l-none bg-transparent"
                onClick={async () => {
                    props.cursorState.resetCursors()

                    await navigate({
                        to: `/$owner/$repo/issues`,
                        search: (p) => ({ ...p, search: searchInput.value }),
                    })
                }}
                aria-label="Search"
            >
                <Search className="h-4 w-4" />
            </Button>
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

function IssuesList(props: { loadingIssues: boolean; issues: FoundIssue[] }) {
    let sortBy = useSearch().sortBy

    return (
        <Card className="py-0">
            <CardContent className="p-0">
                {props.loadingIssues ? (
                    <LoadingList />
                ) : props.issues.length === 0 ? (
                    <div className="text-muted-foreground p-8 text-center">
                        <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p>No issues found matching your criteria.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {props.issues.map((issue) => (
                            <IssueItem key={issue._id} issue={issue} sortBy={sortBy} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function OpenIssuesButton(props: { cursorState: PaginationState; totalIssues?: number }) {
    let search = useSearch()
    let navigate = Route.useNavigate()

    return (
        <Button
            size="sm"
            className="gap-2"
            variant={search.state === 'open' ? 'default' : 'outline'}
            onClick={async () => {
                props.cursorState.resetCursors()
                await navigate({
                    to: `/$owner/$repo/issues`,
                    search: (p) => ({ ...p, state: 'open' }),
                })
            }}
        >
            <AlertCircle className="h-4 w-4" />
            {props.totalIssues ? `${props.totalIssues} Open` : '... Open'}
        </Button>
    )
}

function ClosedIssuesButton(props: { cursorState: PaginationState; totalIssues?: number }) {
    let search = useSearch()
    let navigate = Route.useNavigate()

    return (
        <Button
            size="sm"
            className="gap-2"
            variant={search.state === 'closed' ? 'default' : 'outline'}
            onClick={async () => {
                props.cursorState.resetCursors()
                await navigate({
                    to: `/$owner/$repo/issues`,
                    search: (p) => ({ ...p, state: 'closed' }),
                })
            }}
        >
            <CheckCircle className="h-4 w-4" />
            {props.totalIssues ? `${props.totalIssues} Closed` : '... Closed'}
        </Button>
    )
}
