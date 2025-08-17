import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createAuthClient } from 'better-auth/react'
import { type FunctionArgs, type FunctionReference } from 'convex/server'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'

import { useConvexHttp } from './convex'

// This exists bc of naming conflict with convex.
export const useTanstackQuery = useQuery

const didFirstLoad = proxy({ value: false })

export function usePreloadedQuery<
    Query extends FunctionReference<'query'>,
    Args extends FunctionArgs<Query> | 'skip',
>(query: Query, args: Args) {
    let convexHttp = useConvexHttp()
    let firstLoad = useSnapshot(didFirstLoad)

    let convexQueryOpts = convexQuery(query, args)

    useTanstackQuery({
        queryKey: convexQueryOpts.queryKey,

        queryFn: async () => {
            // @ts-expect-error
            let res = await convexHttp!.query(query, args)

            didFirstLoad.value = true
            return res
        },
        enabled: !!convexHttp && !firstLoad.value,
        staleTime: Infinity,
    })

    let { data } = useTanstackQuery(convexQueryOpts)

    return data
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
    }, [])

    return containerRef
}

import { proxy, useSnapshot } from 'valtio'
import { useProxy } from 'valtio/utils'

export function useMutable<T extends object>(initial: T): T {
    const p = useRef(proxy(initial)).current
    return useProxy(p)
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
