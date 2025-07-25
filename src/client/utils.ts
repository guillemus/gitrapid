import { useEffect, useRef } from 'react'
import { useLocation, useParams } from 'react-router'
import type { GithubFilePath } from '../pages/shared/github-client'
import { useQuery } from '@tanstack/react-query'

// This exists bc of naming conflict with convex.
export const useTanstackQuery = useQuery

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

export type GithubFilePathWithLine = GithubFilePath & {
    highlightedLine?: number
}

function parseLineNumber(hash: string) {
    if (hash[0] === '#') {
        let res = parseInt(hash.slice(2))
        if (isNaN(res)) return

        return res
    }
}

// Transforms
// - /:owner/:repo/tree/*
// - /:owner/:repo/blob/*
// paths into a github file path
export function useGithubFilePath(): GithubFilePathWithLine {
    const params = useParams<{
        owner: string
        repo: string
        '*': string
    }>()

    let location = useLocation()
    let startLineNumber = parseLineNumber(location.hash)

    if (!params.owner) throw new Error(':owner param required')
    if (!params.repo) throw new Error(':repo param required')

    let refAndPath = params['*'] ?? ''

    return {
        owner: params.owner,
        repo: params.repo,
        refAndPath,
        highlightedLine: startLineNumber,
    }
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

import { proxy } from 'valtio'
import { useProxy } from 'valtio/utils'

export function useMutable<T extends object>(initial: T): T {
    const p = useRef(proxy(initial)).current
    return useProxy(p)
}

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

export function useDefined<T>(t?: T) {
    let ref = useRef(t)
    if (t) {
        ref.current = t
    }

    return ref.current
}
