import { useQuery } from '@tanstack/react-query'
import 'github-markdown-css/github-markdown-light.css'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { githubClient } from './lib/github-client'
import { Sidebar } from './sidebar'

function getLanguageFromExtension(filePath: string): string {
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

function CodeRenderer() {
    const params = useParams<SingleFileParams>()
    const filePath = params['*'] || ''
    const { data, error } = useQuery({
        queryKey: ['github-file', params.owner, params.repo, params.ref, filePath],
        queryFn: () =>
            githubClient.getFileContent(params.owner!, params.repo!, filePath, params.ref!),
        enabled: !!(params.owner && params.repo && params.ref && filePath),
    })

    if (error) {
        return <div className="p-4 text-red-600">Error loading file</div>
    }

    const isMarkdown = filePath.toLowerCase().endsWith('.md')
    const githubUrl = `https://github.com/${params.owner}/${params.repo}/blob/${params.ref}/${filePath}`

    if (isMarkdown) {
        return (
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
                    {data}
                </ReactMarkdown>
            </div>
        )
    }

    const language = getLanguageFromExtension(filePath)

    return (
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
                {data || ''}
            </SyntaxHighlighter>
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
