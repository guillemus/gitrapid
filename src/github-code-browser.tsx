import 'github-markdown-css/github-markdown-light.css'

import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { FastNavlink } from './components'
import { githubClient } from './lib/github-client'
import { getLanguageFromExtension, useSingleFileParams } from './lib/utils'
import { Searchbar } from './search-bar'
import { Sidebar } from './sidebar'

type GitHubContentItem = {
    name: string
    path: string
    type: 'file' | 'dir'
    size: number
    download_url: string | null
}

type SingleFileParams = {
    owner: string
    repo: string
    ref: string
    '*'?: string
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
                    <li>
                        <span className="text-gray-500">@ {props.ref}</span>
                    </li>
                    {pathSegments.map((segment, index) => {
                        const segmentPath = pathSegments.slice(0, index + 1).join('/')
                        const isLast = index === pathSegments.length - 1

                        return (
                            <li key={segmentPath}>
                                {isLast ? (
                                    <span>{segment}</span>
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
            <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
            >
                View on GitHub
            </a>
        </div>
    )
}

function CodeRenderer() {
    const params = useSingleFileParams()
    const filePath = params['*'] || ''

    // If at root with no file path, try to load README.md
    const isRoot = !filePath
    const targetPath = isRoot ? 'README.md' : filePath

    const githubContentQuery = useQuery({
        queryKey: ['github-content', params.owner, params.repo, params.ref, targetPath],
        queryFn: () =>
            githubClient.getFileOrFolderContent(
                params.owner!,
                params.repo!,
                targetPath,
                params.ref,
            ),
        enabled: !!(params.owner && params.repo),
        retry: isRoot ? 1 : 3, // Don't retry much for README.md if it doesn't exist
    })

    if (githubContentQuery.error) {
        // If we're at root and README.md doesn't exist, just render nothing
        if (isRoot) {
            return null
        }
        return <div className="p-4 text-red-600">Error loading content</div>
    }

    // Check if data is a folder (array) or file (string)
    const isFolder = Array.isArray(githubContentQuery.data)

    if (isFolder) {
        const folderItems = githubContentQuery.data as GitHubContentItem[]
        const sortedItems = [...folderItems].sort((a, b) => {
            // Folders first, then files
            if (a.type !== b.type) {
                return a.type === 'dir' ? -1 : 1
            }
            // Alphabetical within same type
            return a.name.localeCompare(b.name)
        })

        return (
            <div className="flex h-full flex-col">
                <BreadcrumbsWithGitHubLink
                    owner={params.owner!}
                    repo={params.repo!}
                    ref={params.ref}
                    filePath={filePath}
                    isFolder={true}
                />
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {sortedItems.map((item) => (
                        <FastNavlink
                            key={item.path}
                            to={`/${params.owner}/${params.repo}/blob/${params.ref}/${item.path}`}
                            className="flex items-center gap-2 rounded p-2 hover:bg-gray-100"
                        >
                            <span className="text-sm">{item.type === 'dir' ? '📁' : '📄'}</span>
                            <span>{item.name}</span>
                        </FastNavlink>
                    ))}
                </div>
            </div>
        )
    }

    const fileContent = githubContentQuery.data as string
    const isMarkdown = targetPath.toLowerCase().endsWith('.md')

    if (isMarkdown) {
        return (
            <div className="flex h-full flex-col">
                <BreadcrumbsWithGitHubLink
                    owner={params.owner!}
                    repo={params.repo!}
                    ref={params.ref}
                    filePath={isRoot ? 'README.md' : filePath}
                    isFolder={false}
                />
                <div className="markdown-body max-w-none flex-1 overflow-y-auto p-8">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ node, className, children, ...props }: any) {
                                const inline = !className
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline && match ? (
                                    <SyntaxHighlighter
                                        style={vs as any}
                                        language={match[1]}
                                        PreTag="div"
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                )
                            },
                        }}
                    >
                        {fileContent}
                    </ReactMarkdown>
                </div>
            </div>
        )
    }

    const language = getLanguageFromExtension(targetPath)

    return (
        <div className="flex h-full flex-col">
            <BreadcrumbsWithGitHubLink
                owner={params.owner!}
                repo={params.repo!}
                ref={params.ref}
                filePath={isRoot ? 'README.md' : filePath}
                isFolder={false}
            />
            <div className="flex-1 overflow-y-auto p-4">
                <SyntaxHighlighter
                    style={vs as any}
                    language={language}
                    PreTag="div"
                    customStyle={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: '1.5',
                    }}
                >
                    {fileContent || ''}
                </SyntaxHighlighter>
            </div>
        </div>
    )
}

export function GithubCodeBrowser() {
    return (
        <div className="flex h-full">
            <aside className="h-screen w-64 overflow-y-scroll border-r bg-gray-100 p-4">
                <Sidebar />
            </aside>
            <main className="flex h-screen flex-1 flex-col">
                <Searchbar />

                <CodeRenderer />
            </main>
        </div>
    )
}
