'use client'

import { Button } from '@/components/ui/button'
import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import React, { Suspense, useState } from 'react'
import { codeToHtml } from 'shiki'
import { computeInlineHighlights, parseDiff, type DiffLine } from './diff'
import * as fns from './functions'
import { qcDefault } from './queryClient'

export function PRList() {
    let params = useParams<{ owner: string; repo: string }>()
    let [page, setPage] = useState(1)
    const prs = useQuery(qcopts.listPRs(params.owner, params.repo, page))

    return (
        <div className="min-h-screen p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4">
                {params.owner}/{params.repo} - Pull Requests
            </h1>
            <div>
                <Button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                    prev
                </Button>
                <Button onClick={() => setPage((p) => p + 1)}>next</Button>
            </div>
            <div className="space-y-2">
                {prs.data?.map((pr) => (
                    <PrefetchLink
                        onPrefetch={() => {
                            qcDefault.prefetchQuery(
                                qcopts.getPR(params.owner, params.repo, pr.number),
                            )
                            qcDefault.prefetchQuery(
                                qcopts.getPRFiles(params.owner, params.repo, pr.number),
                            )
                        }}
                        key={pr.number}
                        href={`/${params.owner}/${params.repo}/pull/${pr.number}`}
                        className="block p-4 border rounded hover:bg-zinc-100"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500">#{pr.number}</span>
                            <span className="font-medium">{pr.title}</span>
                            <span
                                className={`text-sm px-2 py-0.5 rounded ${
                                    pr.state === 'open'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-purple-100 text-purple-800'
                                }`}
                            >
                                {pr.state}
                            </span>
                        </div>
                    </PrefetchLink>
                ))}
            </div>
        </div>
    )
}

function DiffLineRow(props: { line: DiffLine; idx: number }) {
    let bgColor = 'bg-white'
    if (props.line.type === 'add') {
        bgColor = 'bg-green-100'
    }
    if (props.line.type === 'remove') {
        bgColor = 'bg-red-50'
    }
    if (props.line.type === 'header') {
        bgColor = 'bg-blue-50'
    }

    let lineNumColor = 'text-zinc-400'
    if (props.line.type === 'add') {
        lineNumColor = 'text-green-700'
    }
    if (props.line.type === 'remove') {
        lineNumColor = 'text-red-700'
    }

    let borderColor = 'border-transparent'
    if (props.line.type === 'add') {
        borderColor = 'border-green-400'
    }
    if (props.line.type === 'remove') {
        borderColor = 'border-red-400'
    }

    let contentElement = <>{props.line.content}</>
    if (props.line.type === 'header') {
        contentElement = <span className="text-blue-700">{props.line.content}</span>
    }
    if (props.line.segments) {
        contentElement = (
            <>
                {props.line.segments.map((seg, i) => {
                    let segClass = ''
                    if (seg.changed) {
                        if (props.line.type === 'add') {
                            segClass = 'bg-green-200 box-decoration-clone'
                        } else {
                            segClass = 'bg-red-200 box-decoration-clone'
                        }
                    }
                    return (
                        <span key={i} className={segClass}>
                            {seg.text}
                        </span>
                    )
                })}
            </>
        )
    }

    return (
        <div key={props.idx} className={`flex ${bgColor} border-l-2 ${borderColor}`}>
            <div className={`${lineNumColor} px-2 text-right select-none min-w-12`}>
                {props.line.oldLineNumber ?? ''}
            </div>
            <div className={`${lineNumColor} px-2 text-right select-none min-w-12`}>
                {props.line.newLineNumber ?? ''}
            </div>
            <div className="px-2 flex-1 whitespace-pre">{contentElement}</div>
        </div>
    )
}

function FileChange(props: {
    file: Awaited<ReturnType<typeof fns.getPRFiles>>[number]
    highlighted: string | undefined
}) {
    let diffLines: DiffLine[] = []
    if (props.file.patch) {
        diffLines = computeInlineHighlights(parseDiff(props.file.patch))
    }

    let diffContent = <div className="p-4 text-zinc-500">Highlighting...</div>
    if (props.highlighted) {
        diffContent = (
            <div className="relative">
                {diffLines.map((line, idx) => (
                    <DiffLineRow key={idx} line={line} idx={idx} />
                ))}
            </div>
        )
    }

    return (
        <div key={props.file.filename} className="border rounded-lg overflow-hidden">
            <div className="bg-zinc-100 p-3 font-mono text-sm border-b">
                <span className="font-semibold">{props.file.filename}</span>
                <span className="text-zinc-500 ml-4">
                    +{props.file.additions} -{props.file.deletions}
                </span>
            </div>
            {props.file.patch && (
                <div className="overflow-x-auto">
                    <div className="font-mono text-sm">{diffContent}</div>
                </div>
            )}
        </div>
    )
}

function DiffViewer(props: { files: { data: Awaited<ReturnType<typeof fns.getPRFiles>> } }) {
    const [highlightedFiles, setHighlightedFiles] = React.useState<Map<string, string>>(new Map())

    React.useEffect(() => {
        if (!props.files.data) return

        async function highlightFiles() {
            const highlighted = new Map<string, string>()

            for (const file of props.files.data!) {
                if (!file.patch) continue

                const diffLines = parseDiff(file.patch)
                const code = diffLines.map((l) => l.content).join('\n')

                const ext = file.filename.split('.').pop() || 'txt'
                const langMap: Record<string, string> = {
                    ts: 'typescript',
                    tsx: 'tsx',
                    js: 'javascript',
                    jsx: 'jsx',
                    py: 'python',
                    md: 'markdown',
                    json: 'json',
                    css: 'css',
                    html: 'html',
                    yml: 'yaml',
                    yaml: 'yaml',
                }

                try {
                    const html = await codeToHtml(code, {
                        lang: langMap[ext] || 'text',
                        theme: 'github-light',
                    })
                    highlighted.set(file.filename, html)
                } catch (e) {
                    console.error('Failed to highlight', file.filename, e)
                }
            }

            setHighlightedFiles(highlighted)
        }

        highlightFiles()
    }, [props.files.data])

    if (!props.files.data || props.files.data.length === 0) {
        return <div>No file changes</div>
    }

    return (
        <div className="space-y-6">
            {props.files.data.map((file) => {
                const highlighted = highlightedFiles.get(file.filename)
                return <FileChange key={file.filename} file={file} highlighted={highlighted} />
            })}
        </div>
    )
}

export function PRDetail() {
    let props = useParams<{
        owner: string
        repo: string
        number: string
    }>()

    let [pr, prFiles] = useQueries({
        queries: [
            qcopts.getPR(props.owner, props.repo, Number(props.number)),
            qcopts.getPRFiles(props.owner, props.repo, Number(props.number)),
        ],
    })

    const data = pr.data
    let loading = pr.isLoading || prFiles.isLoading

    return (
        <div>
            <PrefetchLink
                onPrefetch={() => {
                    qcDefault.prefetchQuery(qcopts.listPRs(props.owner, props.repo))
                }}
                href={`/${props.owner}/${props.repo}/pulls`}
                className="text-blue-600 hover:underline mb-4 block"
            >
                &larr; Back to {props.owner}/{props.repo}/pulls
            </PrefetchLink>
            {!loading && (
                <>
                    <h1 className="text-2xl font-bold mb-2">
                        #{data?.number} {data?.title}
                    </h1>
                    <div className="flex items-center gap-2 mb-4">
                        <span
                            className={`text-sm px-2 py-0.5 rounded ${
                                data?.state === 'open'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-purple-100 text-purple-800'
                            }`}
                        >
                            {data?.state}
                        </span>
                        <span className="text-zinc-500">opened by {data?.user?.login}</span>
                    </div>
                    {data?.body && (
                        <div className="border rounded p-4 whitespace-pre-wrap mb-6">
                            {data.body}
                        </div>
                    )}
                </>
            )}
            {!loading && prFiles.data && (
                <div className="mt-6">
                    <div role="tablist" className="tabs tabs-border">
                        <button role="tab" className="tab tab-active">
                            Files ({prFiles.data.length || 0})
                        </button>
                    </div>
                    <div className="pt-4">
                        <DiffViewer files={{ data: prFiles.data }} />
                    </div>
                </div>
            )}
        </div>
    )
}

export function ClientOnly(props: React.PropsWithChildren) {
    let [isClient, setIsClient] = React.useState(false)

    React.useEffect(() => {
        setIsClient(true)
    }, [])

    if (!isClient) {
        return null
    }

    return props.children
}

export namespace qcopts {
    export const listPRs = (owner: string, repo: string, page?: number) =>
        queryOptions({
            queryKey: ['prs', owner, repo, page],
            queryFn: () => fns.listPRs(owner, repo, page),
        })

    export const getPR = (owner: string, repo: string, number: number) =>
        queryOptions({
            queryKey: ['pr', owner, repo, number],
            queryFn: () => fns.getPR(owner, repo, number),
        })

    export const getPRFiles = (owner: string, repo: string, number: number) =>
        queryOptions({
            queryKey: ['pr-files', owner, repo, number],
            queryFn: () => fns.getPRFiles(owner, repo, number),
        })
}

export function PrefetchLink(props: {
    href: string
    className?: string
    onPrefetch: () => void
    children: React.ReactNode
}) {
    function onMouseDown() {
        props.onPrefetch()
    }

    return (
        <Link href={props.href} onMouseDown={onMouseDown} className={props.className}>
            {props.children}
        </Link>
    )
}

export function GithubLink() {
    return (
        <Suspense>
            <Inner></Inner>
        </Suspense>
    )

    function Inner() {
        let path = usePathname()
        console.log(path)
        return (
            <div className="absolute top-0 right-0">
                <a href={`https://github.com${path}`} target="_blank">
                    go to github
                </a>
            </div>
        )
    }
}
