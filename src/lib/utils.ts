
import { useParams } from 'react-router'
import type { GetContentResponse, GithubFilePath } from './github-client'
import { useEffect, useRef } from 'react'

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

type Success<T> = {
    data: T
    error: null
}

type Failure<E> = {
    data: null
    error: E
}

export type Result<T, E = Error> = Success<T> | Failure<E>

export function ok<T>(val: T): Success<T> {
    return { data: val, error: null }
}

export function err(msg: string): Failure<Error> {
    return { data: null, error: new Error(msg) }
}

export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
    try {
        const data = await promise
        return { data, error: null }
    } catch (error) {
        return { data: null, error: error as E }
    }
}

export function unwrap<T, E>(res: Result<T, E>): T {
    if (res.error) {
        throw res.error
    }

    return res.data as T
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

export function transformFileContentsResponse(fileContents: GetContentResponse) {
    if (Array.isArray(fileContents)) {
        type FolderContents = {
            name: string
            path: string
            isDir: boolean
        }
        const contents: FolderContents[] = []
        for (const file of fileContents) {
            contents.push({
                isDir: file.type === 'dir',
                name: file.name,
                path: file.path,
            })
        }

        return { type: 'folder', contents: contents } as const
    }

    if (fileContents.type === 'file') {
        return {
            type: 'file',
            name: fileContents.name,
            path: fileContents.path,
            contents: fileContents.content,
        } as const
    }

    return null
}
