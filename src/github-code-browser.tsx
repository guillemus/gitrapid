import 'github-markdown-css/github-markdown-light.css'

import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { FaFolder, FaFile } from 'react-icons/fa'
import {
    createHighlighter,
    type BundledLanguage,
    type BundledTheme,
    type HighlighterGeneric,
} from 'shiki'
import { FastNavlink } from './components'
import { getFileOrFolderContent } from './lib/github-client'
import { getLanguageFromExtension, unwrap, useGithubFilePath } from './lib/utils'
import { Searchbar } from './repo-search-bar'
import { CodeSearchBar } from './code-search-bar'

// Custom hook for shiki
function useShiki() {
    const [highlighter, setHighlighter] =
        useState<HighlighterGeneric<BundledLanguage, BundledTheme>>()

    useEffect(() => {
        createHighlighter({
            themes: ['github-dark'],
            langs: [
                'javascript',
                'typescript',
                'jsx',
                'tsx',
                'css',
                'html',
                'json',
                'markdown',
                'python',
                'java',
                'go',
                'rust',
                'php',
                'ruby',
                'shell',
                'yaml',
                'xml',
                'sql',
                'bash',
            ],
        }).then((h) => setHighlighter(h))
    }, [])

    return highlighter
}

// Component for syntax highlighting
function ShikiCodeBlock({ code, language }: { code: string; language?: string }) {
    const highlighter = useShiki()

    // Skip highlighting for very large files (>100KB or >5000 lines)
    const isLargeFile = code.length > 100000 || code.split('\n').length > 5000

    if (!highlighter || isLargeFile) {
        return (
            <pre
                className="bg-gray-900 p-4 text-sm text-gray-100"
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >
                <code>{code}</code>
            </pre>
        )
    }

    try {
        const html = highlighter.codeToHtml(code, {
            lang: language || 'text',
            theme: 'github-dark',
        })

        return (
            <div
                className="overflow-x-auto p-4 text-sm"
                style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
            />
        )
    } catch (error) {
        console.error(error)
        // Fallback for unsupported languages
        return (
            <pre
                className="bg-gray-900 p-4 text-sm text-gray-100"
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >
                <code>{code}</code>
            </pre>
        )
    }
}

type BreadcrumbsWithGitHubLinkProps = {
    owner: string
    repo: string
    ref: string
    filePath: string
    isFolder: boolean
}

function BreadcrumbsWithGitHubLink(props: BreadcrumbsWithGitHubLinkProps) {
    const pathSegments = props.filePath ? props.filePath.split('/').filter(Boolean) : []
    const githubUrl = `https://github.com/${props.owner}/${props.repo}/${
        props.isFolder ? 'tree' : 'blob'
    }/${props.ref}/${props.filePath}`

    return (
        <div className="flex items-center justify-between border-b bg-gray-50 p-4">
            <div className="breadcrumbs text-sm">
                <ul>
                    <li>
                        <FastNavlink to={`/${props.owner}/${props.repo}`} className="link">
                            {props.owner}/{props.repo}
                        </FastNavlink>
                    </li>
                    {pathSegments.map((segment, index) => {
                        const segmentPath = pathSegments.slice(0, index + 1).join('/')
                        const isLast = index === pathSegments.length - 1

                        return (
                            <li key={segmentPath}>
                                {isLast ? (
                                    <span className="font-semibold">{segment}</span>
                                ) : (
                                    <FastNavlink
                                        to={`/${props.owner}/${props.repo}/tree/${props.ref}/${segmentPath}`}
                                        className="link"
                                    >
                                        {segment}
                                    </FastNavlink>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </div>

            <div className="flex items-center gap-4">
                <Searchbar />
                <CodeSearchBar owner={props.owner} repo={props.repo} />

                <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                >
                    View on GitHub
                </a>
            </div>
        </div>
    )
}

export function CodeRenderer() {
    const params = useGithubFilePath()

    const fileContentsQuery = useQuery({
        queryKey: ['github-content', params],
        queryFn: async () => getFileOrFolderContent(params).then(unwrap),
        enabled: !!(params.owner && params.repo),
        retry: params.root ? 1 : 3, // Don't retry much for README.md if it doesn't exist
    })

    if (fileContentsQuery.error) {
        // If we're at root and README.md doesn't exist, just render nothing
        if (params.root) {
            return null
        }
        return <div className="p-4 text-red-600">Error loading content</div>
    }

    if (!fileContentsQuery.data) return null

    let data = fileContentsQuery.data

    if (data.type === 'folder') {
        let sorted = [...data.contents]
        sorted.sort((a, b) => {
            if (a.isDir) return -1
            if (b.isDir) return -1

            return a.name.localeCompare(b.name)
        })

        return (
            <CodeLayout>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {sorted.map((item) => (
                        <FastNavlink
                            key={item.path}
                            to={`/${params.owner}/${params.repo}/blob/${params.ref}/${item.path}`}
                            className="flex items-center gap-2 rounded p-2 hover:bg-gray-100"
                        >
                            {item.isDir ? (
                                <FaFolder className="text-sm" />
                            ) : (
                                <FaFile className="text-sm" />
                            )}
                            <span>{item.name}</span>
                        </FastNavlink>
                    ))}
                </div>
            </CodeLayout>
        )
    }

    let file = data
    const isMarkdown = file.path.toLowerCase().endsWith('.md')

    if (isMarkdown) {
        const htmlContent = marked(file.contents) as string
        return (
            <CodeLayout>
                <div
                    className="markdown-body max-w-none flex-1 overflow-auto p-8"
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(htmlContent),
                    }}
                />
            </CodeLayout>
        )
    }

    const language = getLanguageFromExtension(file.path)

    return (
        <CodeLayout>
            <div style={{ overflowY: 'scroll', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                <ShikiCodeBlock code={file.contents} language={language} />
            </div>
        </CodeLayout>
    )
}

function CodeLayout(props: PropsWithChildren) {
    const params = useGithubFilePath()
    return (
        <div className="flex h-full flex-col">
            <BreadcrumbsWithGitHubLink
                owner={params.owner!}
                repo={params.repo!}
                ref={params.ref}
                filePath={params.path}
                isFolder={false}
            />
            <div className="flex-1 overflow-y-auto p-4">{props.children}</div>
        </div>
    )
}
