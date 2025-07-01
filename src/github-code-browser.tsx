import 'github-markdown-css/github-markdown-light.css'

import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { FaFile, FaFolder } from 'react-icons/fa'
import { BreadcrumbsWithGitHubLink, FastNavlink } from './components'
import { getFileOrFolderContent } from './lib/github-client'
import { getLanguageFromExtension, unwrap, useGithubFilePath } from './lib/utils'
import { ShikiCodeBlock } from './shiki-code-block'

function CodeRenderer() {
    const params = useGithubFilePath()

    const fileContentsQuery = useQuery({
        queryKey: ['github-content', params],
        queryFn: () => getFileOrFolderContent(params).then(unwrap),
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
            if (a.isDir && !b.isDir) return -1
            if (!a.isDir && b.isDir) return 1

            return a.name.localeCompare(b.name)
        })

        return (
            <div className="flex-1 space-y-2 p-4">
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
                className="markdown-body max-w-none flex-1 p-8"
                dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(htmlContent),
                }}
            />
        )
    }

    const language = getLanguageFromExtension(file.path)

    return (
        <div style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
            <ShikiCodeBlock showLines code={file.contents} language={language} />
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
