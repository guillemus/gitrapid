import { useQuery } from '@tanstack/react-query'
import 'github-markdown-css/github-markdown-light.css'
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { githubClient } from './lib/github-client'
import { Sidebar } from './sidebar'
import { getLanguageFromExtension } from './lib/utils'

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

type BreadcrumbsProps = {
    owner: string
    repo: string
    ref: string
    filePath: string
}

function Breadcrumbs(props: BreadcrumbsProps) {
    const pathSegments = props.filePath ? props.filePath.split('/').filter(Boolean) : []

    return (
        <div className="breadcrumbs text-sm p-4 bg-gray-50">
            <ul>
                <li>
                    <Link to={`/${props.owner}/${props.repo}/blob/${props.ref}`} className="link">
                        {props.owner}/{props.repo}
                    </Link>
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
                                <Link
                                    to={`/${props.owner}/${props.repo}/blob/${props.ref}/${segmentPath}`}
                                    className="link"
                                >
                                    {segment}
                                </Link>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

function CodeRenderer() {
    const params = useParams<SingleFileParams>()
    const filePath = params['*'] || ''
    const { data, error } = useQuery({
        queryKey: ['github-content', params.owner, params.repo, params.ref, filePath],
        queryFn: () =>
            githubClient.getFileOrFolderContent(params.owner!, params.repo!, filePath, params.ref!),
        enabled: !!(params.owner && params.repo && params.ref),
    })

    if (error) {
        return <div className="p-4 text-red-600">Error loading content</div>
    }

    // Check if data is a folder (array) or file (string)
    const isFolder = Array.isArray(data)

    if (isFolder) {
        const folderItems = data as GitHubContentItem[]
        const githubUrl = `https://github.com/${params.owner}/${params.repo}/tree/${params.ref}/${filePath}`

        return (
            <div>
                <Breadcrumbs
                    owner={params.owner!}
                    repo={params.repo!}
                    ref={params.ref!}
                    filePath={filePath}
                />
                <div className="p-4">
                    <div className="mb-4 pb-4 border-b flex justify-end">
                        <a
                            href={githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                        >
                            View on GitHub
                        </a>
                    </div>
                    <div className="space-y-2">
                        {folderItems.map((item) => (
                            <Link
                                key={item.path}
                                to={`/${params.owner}/${params.repo}/blob/${params.ref}/${item.path}`}
                                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded"
                            >
                                <span className="text-sm">{item.type === 'dir' ? '📁' : '📄'}</span>
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    const fileContent = data as string
    const isMarkdown = filePath.toLowerCase().endsWith('.md')
    const githubUrl = `https://github.com/${params.owner}/${params.repo}/blob/${params.ref}/${filePath}`

    if (isMarkdown) {
        return (
            <div>
                <Breadcrumbs
                    owner={params.owner!}
                    repo={params.repo!}
                    ref={params.ref!}
                    filePath={filePath}
                />
                <div className="markdown-body p-8 max-w-none">
                    <div className="mb-4 pb-4 border-b flex justify-end">
                        <a
                            href={githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                        >
                            View on GitHub
                        </a>
                    </div>
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

    const language = getLanguageFromExtension(filePath)

    return (
        <div>
            <Breadcrumbs
                owner={params.owner!}
                repo={params.repo!}
                ref={params.ref!}
                filePath={filePath}
            />
            <div className="p-4">
                <div className="mb-4 pb-4 border-b flex justify-end">
                    <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                    >
                        View on GitHub
                    </a>
                </div>
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
        <div className="flex h-full ">
            <aside className="w-64 bg-gray-100 border-r h-screen overflow-y-scroll p-4">
                <Sidebar />
            </aside>
            <main className="flex-1 h-screen overflow-y-scroll">
                <CodeRenderer />
            </main>
        </div>
    )
}
