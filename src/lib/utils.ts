import { convexQuery } from '@convex-dev/react-query'
import { useHookstate } from '@hookstate/core'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { clsx, type ClassValue } from 'clsx'
import { type FunctionArgs, type FunctionReference, type PaginationResult } from 'convex/server'
import { formatDistanceToNow, isYesterday, differenceInMinutes } from 'date-fns'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { useEffect, useEffectEvent, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Configure marked once for speed and predictable output
marked.use(gfmHeadingId())
marked.setOptions({ gfm: true })

export function renderMarkdownToHtml(markdown: string): string {
    let input = typeof markdown === 'string' ? markdown : ''
    let parsed = marked.parse(input, {
        breaks: true,
    })
    let html = typeof parsed === 'string' ? parsed : ''
    let sanitized = DOMPurify.sanitize(html)
    return sanitized
}

// The websocket connection takes from 700ms to 1.2s to start out, so the http
// client gives us around 300ms of load improvement
export function useTanstackQuery<
    Query extends FunctionReference<'query'>,
    Args extends FunctionArgs<Query> | 'skip',
>(query: Query, args: Args, queryClient?: QueryClient) {
    let wsQuery = useQuery(convexQuery(query, args), queryClient)
    return wsQuery.data
}

export function getLanguageFromExtension(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        py: 'python',
        rb: 'ruby',
        php: 'php',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        cs: 'csharp',
        go: 'go',
        rs: 'rust',
        sh: 'bash',
        bash: 'bash',
        zsh: 'bash',
        fish: 'bash',
        css: 'css',
        scss: 'scss',
        sass: 'sass',
        html: 'html',
        xml: 'xml',
        json: 'json',
        yaml: 'yaml',
        yml: 'yaml',
        toml: 'toml',
        sql: 'sql',
        dockerfile: 'dockerfile',
        makefile: 'makefile',
        vim: 'vim',
        lua: 'lua',
        r: 'r',
        matlab: 'matlab',
        swift: 'swift',
        kotlin: 'kotlin',
        dart: 'dart',
        scala: 'scala',
        clojure: 'clojure',
        haskell: 'haskell',
        elm: 'elm',
        elixir: 'elixir',
        erlang: 'erlang',
        f90: 'fortran',
        asm: 'nasm',
        s: 'nasm',
        pl: 'perl',
        tcl: 'tcl',
        vb: 'vbnet',
        pas: 'pascal',
        ada: 'ada',
        cobol: 'cobol',
        lisp: 'lisp',
        scheme: 'scheme',
        prolog: 'prolog',
        tex: 'latex',
        diff: 'diff',
        patch: 'diff',
        log: 'log',
        ini: 'ini',
        cfg: 'ini',
        conf: 'ini',
        properties: 'properties',
    }
    return languageMap[extension || ''] || 'text'
}

export function useClickOutside(onclickOutside: () => void) {
    const containerRef = useRef<HTMLDivElement>(null)

    let handleClickOutside = useEffectEvent((event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            onclickOutside()
        }
    })

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return containerRef
}

// export function useMutable<T extends object>(initial: T): T {
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     let c = useMemo(() => proxy(initial), [])
//     useSnapshot(c)
//     return c
// }

export function useDefined<T>(t?: T) {
    let ref = useRef(t)
    if (t !== undefined) {
        ref.current = t
    }

    return ref.current
}

export type GithubParams = {
    owner: string
    repo: string
    refAndPath: string
}

/**
 * Formats a date as relative time (e.g., "50 minutes ago", "2 days ago")
 * Similar to GitHub's time formatting
 */
export function formatRelativeTime(date: string | number | Date): string {
    try {
        return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
        // Fallback to locale date string if parsing fails
        return new Date(date).toLocaleDateString()
    }
}

/**
 * Formats a date in GitHub's style (e.g., "just now", "yesterday", "5 minutes ago", "2 hours ago")
 */
export function formatGitHubTime(date: string | number | Date): string {
    try {
        let dateObj = new Date(date)
        let minutesDiff = differenceInMinutes(new Date(), dateObj)

        // "just now" for items < 1 minute old
        if (minutesDiff < 1) {
            return 'just now'
        }

        // "yesterday" for items from yesterday
        if (isYesterday(dateObj)) {
            return 'yesterday'
        }

        // Use formatDistanceToNow with addSuffix for other cases
        return formatDistanceToNow(dateObj, { addSuffix: true })
    } catch {
        // Fallback to locale date string if parsing fails
        return new Date(date).toLocaleDateString()
    }
}

export type PaginationState = ReturnType<typeof usePaginationState>

export function usePaginationState() {
    let state = useHookstate({
        index: 0,
        cursors: [null] as (string | null)[],
    })

    function resetCursors() {
        state.set({ index: 0, cursors: [null] })
    }

    function currCursor() {
        let index = state.index.get()
        let curr = state.cursors[index]?.get()

        return curr ?? null
    }

    function canGoPrev() {
        return state.index.get() > 0
    }

    function goToPrev() {
        if (state.index.get() > 0) {
            state.index.set((x) => x - 1)
        }
    }

    function canGoNext(pag?: PaginationResult<unknown>) {
        if (!pag) return false

        return !pag.isDone
    }

    function goToNext(pag?: PaginationResult<unknown>) {
        if (!pag) return
        if (!canGoNext(pag)) return

        let nextCursor = pag.continueCursor

        state.index.set((x) => x + 1)
        if (currCursor() === null) {
            state.cursors[state.cursors.length]?.set(nextCursor)
        }
    }

    function shouldShowPagination(pag?: PaginationResult<unknown>) {
        return canGoPrev() || canGoNext(pag)
    }

    return {
        currCursor,
        resetCursors,
        canGoPrev,
        goToPrev,
        canGoNext,
        goToNext,
        shouldShowPagination,
    }
}
