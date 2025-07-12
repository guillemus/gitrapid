import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import type { GithubFilePath } from '../shared/github-client'

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

export type GithubFilePathWithRoot = GithubFilePath & {
    isRoot: boolean
}

// Transforms
// - /:owner/:repo/tree/:ref/*
// - /:owner/:repo/blob/:ref/*
// paths into a github file path
export function useGithubFilePath(): GithubFilePathWithRoot {
    const params = useParams<{
        owner: string
        repo: string
        ref: string
        '*': string
    }>()

    if (!params.owner) throw new Error(':owner param required')
    if (!params.repo) throw new Error(':repo param required')

    let ref = params.ref
    if (!ref) {
        ref = 'HEAD'
    }

    let path = params['*']
    let root = false
    if (!path) {
        path = 'README.md'
        root = true
    }

    return {
        owner: params.owner,
        repo: params.repo,
        ref,
        path,
        isRoot: root,
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

export const pageLoadSession = authClient.getSession()
