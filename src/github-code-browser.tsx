import 'github-markdown-css/github-markdown-light.css'

import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useState } from 'react'
import { FaFile, FaFolder } from 'react-icons/fa'
import {
    createHighlighter,
    type BundledLanguage,
    type BundledTheme,
    type HighlighterGeneric,
} from 'shiki'
import { BreadcrumbsWithGitHubLink, FastNavlink } from './components'
import { getFileOrFolderContent } from './lib/github-client'
import { getLanguageFromExtension, unwrap, useGithubFilePath } from './lib/utils'

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

function CodeRenderer() {
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
        )
    }

    let file = data
    const isMarkdown = file.path.toLowerCase().endsWith('.md')

    if (isMarkdown) {
        const htmlContent = marked(file.contents) as string
        return (
            <div
                className="markdown-body max-w-none flex-1 overflow-auto p-8"
                dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(htmlContent),
                }}
            />
        )
    }

    const language = getLanguageFromExtension(file.path)

    return (
        <div style={{ overflowY: 'scroll', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
            <ShikiCodeBlock code={file.contents} language={language} />
        </div>
    )
}

export function CodeBrowser() {
    return (
        <div className="flex h-full flex-col">
            <BreadcrumbsWithGitHubLink />
            <div className="flex-1 overflow-y-auto p-4">
                <CodeRenderer></CodeRenderer>
            </div>
        </div>
    )
}
