import { useQuery } from '@tanstack/react-query'
import 'github-markdown-css/github-markdown-light.css'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { Sidebar } from './sidebar'

function buildRawUrl(owner: string, repo: string, ref: string, filePath: string) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${ref}/${filePath}`
}

function CodeRenderer() {
    const params = useParams<SingleFileParams>()
    const filePath = params['*'] || ''
    const rawUrl = buildRawUrl(params.owner!, params.repo!, params.ref!, filePath)

    const { data, isLoading, error } = useQuery({
        queryKey: ['github-file', params.owner, params.repo, params.ref, filePath],
        queryFn: () => fetch(rawUrl).then((res) => res.text()),
        enabled: !!(params.owner && params.repo && params.ref),
    })

    console.log(data)

    if (error) return <div className="p-4 text-red-600">Error loading file</div>

    const isMarkdown = filePath.toLowerCase().endsWith('.md')

    if (isMarkdown) {
        return (
            <div className="markdown-body p-8 max-w-none">
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
                    {data}
                </ReactMarkdown>
            </div>
        )
    }

    return (
        <div className="p-4">
            <pre className="whitespace-pre-wrap">{data}</pre>
        </div>
    )
}

export function GithubCodeBrowser() {
    return (
        <div className="flex h-full ">
            <aside className="w-64 bg-gray-100 border-r h-full p-4">
                <Sidebar />
            </aside>
            <main className="flex-1 h-full overflow-auto">
                <CodeRenderer />
            </main>
        </div>
    )
}
