import 'github-markdown-css/github-markdown-light.css'

import { useGithubFilePath } from '@/client/utils'
import { useQuery } from '@tanstack/react-query'
import { FaFile, FaFolder } from 'react-icons/fa'
import { BreadcrumbsWithGitHubLink, FastNavlink } from '@/client/components'
import { parsedFileOptions } from './queryOptions'
import { CodeBlock, CodeBlockWithParsing, MarkdownBlock } from './code-block'

function CodeRenderer() {
    const params = useGithubFilePath()

    const fileContentsQuery = useQuery(parsedFileOptions(params, { showLines: true }))

    if (fileContentsQuery.error) {
        // If we're at root and README.md doesn't exist, just render nothing
        if (params.isRoot) {
            return null
        }
        return <div className="p-4 text-red-600">Error loading content</div>
    }

    if (!fileContentsQuery.data) return null

    const file = fileContentsQuery.data

    if (file.type === 'folder') {
        const sorted = [...file.contents]
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

    if (file.type === 'markdown') {
        return <MarkdownBlock markdown={file.contents}></MarkdownBlock>
    }

    return (
        <div style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
            <CodeBlock code={file.contents} />
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
