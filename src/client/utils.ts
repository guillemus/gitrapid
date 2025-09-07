import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createAuthClient } from 'better-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router'
import { proxy, useSnapshot } from 'valtio'

import type { Doc } from '@convex/_generated/dataModel'
import { type FunctionArgs, type FunctionReference, getFunctionName } from 'convex/server'
import { useConvexHttp } from './convex'

// These exists bc of naming conflict with convex. This way is much easier to autoimport without naming conflicts
export const useTanstackQuery = useQuery
export const useTanstackMutation = useMutation

const didFirstLoad = proxy({ value: false })

// The websocket connection takes from 700ms to 1.2s to start out, so the http
// client gives us around 300ms of load improvement
export function usePageQuery<
    Query extends FunctionReference<'query'>,
    Args extends FunctionArgs<Query> | 'skip',
>(query: Query, args: Args) {
    let convexHttp = useConvexHttp()
    let firstLoad = useSnapshot(didFirstLoad)

    let httpQuery = useTanstackQuery({
        queryKey: ['convexHttpQuery', getFunctionName(query), args],

        queryFn: async () => {
            // @ts-expect-error: disable for simplicity
            let res = await convexHttp!.query(query, args)

            didFirstLoad.value = true
            return res
        },
        enabled: !!convexHttp && !firstLoad.value,
        staleTime: Infinity,
    })

    let wsQuery = useTanstackQuery(convexQuery(query, args))

    return wsQuery.data ?? httpQuery.data
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

export function useDebounce<T>(value: T, delay: number): T {
    const state = useMutable({ debouncedValue: value })

    useEffect(() => {
        const handler = setTimeout(() => {
            state.debouncedValue = value
        }, delay)

        return () => {
            clearTimeout(handler)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, delay])

    return state.debouncedValue
}

export function useClickOutside(onclickOutside: () => void) {
    const containerRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onclickOutside()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return containerRef
}

export function useMutable<T extends object>(initial: T): T {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    let c = useMemo(() => proxy(initial), [])
    useSnapshot(c)
    return c
}

export const authClient = createAuthClient()

export function useDefined<T>(t?: T) {
    let ref = useRef(t)
    if (t) {
        ref.current = t
    }

    return ref.current
}

export type GithubParams = {
    owner: string
    repo: string
    refAndPath: string
}

export function useGithubParams(): GithubParams {
    let params = useParams()

    let owner = params.owner
    if (!owner) throw new Error(':owner required')
    let repo = params.repo
    if (!repo) throw new Error(':repo required')

    let refAndPath = params['*'] ?? ''

    return { owner, repo, refAndPath }
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

type GithubUser = Doc<'issues'>['author']

export function isGithubUserObject(u: GithubUser): u is { id: number; login: string } {
    return typeof u === 'object' && u !== null && 'login' in u
}

export function userLogin(u: GithubUser): string | null {
    if (isGithubUserObject(u)) return u.login
    return null
}

export function userLabel(u: GithubUser): string {
    if (u === 'github-actions') return 'GitHub Actions'
    let login = userLogin(u)
    return login ?? 'ghost'
}
