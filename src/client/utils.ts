import { useQuery, type QueryKey } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

// This exists bc of naming conflict with convex.
export const useTanstackQuery = useQuery

const $firstLoad = proxy({ value: false })

/**
 * A query that will execute on first load only. After execution it will be
 * forever disabled.
 */
export function useFirstLoadQuery<T>(args: {
    queryKey: QueryKey
    queryFn: (c: ConvexHttpClient) => Promise<T>
}) {
    let convexHttp = useConvexHttp()
    let firstLoad = useSnapshot($firstLoad)

    const { data } = useTanstackQuery({
        queryKey: args.queryKey,
        queryFn: async () => {
            let res = await args.queryFn(convexHttp!)
            $firstLoad.value = true
            return res
        },
        enabled: !!convexHttp && !firstLoad.value,
        staleTime: Infinity,
    })

    return data ?? null
}

export function usePageQuery<
    Query extends FunctionReference<'query'>,
    Args extends FunctionArgs<Query> | 'skip',
>(queryKey: QueryKey, query: Query, args: Args) {
    let convexHttp = useConvexHttp()
    let firstLoad = useSnapshot($firstLoad)

    const { data: firstLoadPage } = useTanstackQuery({
        queryKey: queryKey,
        queryFn: async () => {
            // @ts-expect-error
            let res = await convexHttp!.query(query, args)

            $firstLoad.value = true
            return res
        },
        enabled: !!convexHttp && !firstLoad.value,
        staleTime: Infinity,
    })

    let { data: subscribedPage } = useTanstackQuery(convexQuery(query, args))

    return subscribedPage ?? firstLoadPage
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

import { createAuthClient } from 'better-auth/react'
import type { ConvexHttpClient } from 'convex/browser'
import { useParams } from 'react-router'
import { useConvexHttp } from './convex'
import type { FunctionArgs, FunctionReference } from 'convex/server'
import { convexQuery } from '@convex-dev/react-query'

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

let _installationsHandle = 'gitrapid-com-dev'
if (import.meta.env.PROD) {
    _installationsHandle = 'gitrapid-com'
}

export const installationsHandle = _installationsHandle
