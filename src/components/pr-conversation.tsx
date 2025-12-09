import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Skeleton } from '@/components/ui/skeleton'
import { qc } from '@/lib'
import * as fns from '@/server/functions'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useRef } from 'react'

type CommentType = 'issue' | 'review'

type UnifiedComment = {
    type: CommentType
    id: number
    body: string
    created_at: string
    user: { login: string; avatar_url: string } | null
    // review comment extras
    path?: string
    line?: number | null
    diff_hunk?: string
}

export function PRConversation() {
    let params = useParams({ strict: false }) as { owner: string; repo: string; number: string }
    let owner = params.owner
    let repo = params.repo
    let number = Number(params.number)

    let pr = useQuery(qc.useGetPROpts(owner, repo, number))

    let issueComments = useInfiniteQuery({
        queryKey: ['pr-comments', owner, repo, number],
        queryFn: ({ pageParam }) =>
            fns.getPRComments({ data: { owner, repo, number, page: pageParam } }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, _, lastPageParam) =>
            lastPage.length < 30 ? undefined : lastPageParam + 1,
    })

    let reviewComments = useInfiniteQuery({
        queryKey: ['pr-review-comments', owner, repo, number],
        queryFn: ({ pageParam }) =>
            fns.getPRReviewComments({ data: { owner, repo, number, page: pageParam } }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, _, lastPageParam) =>
            lastPage.length < 30 ? undefined : lastPageParam + 1,
    })

    // Merge and sort chronologically
    let allComments: UnifiedComment[] = []

    for (let page of issueComments.data?.pages ?? []) {
        for (let c of page) {
            allComments.push({
                type: 'issue',
                id: c.id,
                body: c.body ?? '',
                created_at: c.created_at,
                user: c.user,
            })
        }
    }

    for (let page of reviewComments.data?.pages ?? []) {
        for (let c of page) {
            allComments.push({
                type: 'review',
                id: c.id,
                body: c.body,
                created_at: c.created_at,
                user: c.user,
                path: c.path,
                line: c.line,
                diff_hunk: c.diff_hunk,
            })
        }
    }

    allComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Infinite scroll
    let sentinelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let sentinel = sentinelRef.current
        if (!sentinel) return

        let observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                if (issueComments.hasNextPage && !issueComments.isFetchingNextPage) {
                    issueComments.fetchNextPage()
                }
                if (reviewComments.hasNextPage && !reviewComments.isFetchingNextPage) {
                    reviewComments.fetchNextPage()
                }
            }
        })

        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [issueComments, reviewComments])

    let isInitialLoading = issueComments.isLoading || reviewComments.isLoading

    return (
        <div className="space-y-4">
            {/* PR body */}
            {pr.isLoading ? (
                <div className="border rounded p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            ) : pr.data?.body ? (
                <div className="border rounded p-4">
                    <MarkdownRenderer content={pr.data.body} />
                </div>
            ) : (
                <div className="text-zinc-500 italic">No description provided.</div>
            )}

            {/* Comments */}
            {isInitialLoading ? (
                <ConversationSkeleton />
            ) : (
                allComments.map((comment) => (
                    <CommentCard key={`${comment.type}-${comment.id}`} comment={comment} />
                ))
            )}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading indicator */}
            {(issueComments.isFetchingNextPage || reviewComments.isFetchingNextPage) && (
                <div className="text-zinc-500 text-center">Loading more...</div>
            )}
        </div>
    )
}

function ConversationSkeleton() {
    return (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border rounded p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="w-24 h-4" />
                        <Skeleton className="w-16 h-3" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            ))}
        </>
    )
}

function CommentCard(props: { comment: UnifiedComment }) {
    let comment = props.comment
    let timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })

    return (
        <div className="border rounded p-4 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2 text-sm">
                {comment.user?.avatar_url && (
                    <img
                        src={comment.user.avatar_url}
                        alt={comment.user.login}
                        className="w-6 h-6 rounded-full"
                    />
                )}
                <span className="font-medium">{comment.user?.login ?? 'unknown'}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-500">{timeAgo}</span>
            </div>

            {/* Review comment: file badge + diff hunk */}
            {comment.type === 'review' && (
                <>
                    {comment.path && (
                        <div className="text-xs text-zinc-500">
                            📁 {comment.path}
                            {comment.line != null && `:${comment.line}`}
                        </div>
                    )}
                    {comment.diff_hunk && (
                        <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
                            {comment.diff_hunk}
                        </pre>
                    )}
                </>
            )}

            {/* Body */}
            <MarkdownRenderer content={comment.body} />
        </div>
    )
}
