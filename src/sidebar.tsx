import 'github-markdown-css/github-markdown-light.css'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { FastNavlink } from './components'

type FileItem = {
    name: string
    path: string
    type: 'file' | 'dir'
    url: string
}

type ExpandableFileItem = FileItem & {
    children?: ExpandableFileItem[]
    isLoading?: boolean
}

export function Sidebar() {
    const params = useParams<SingleFileParams>()
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [fileTree, setFileTree] = useState<ExpandableFileItem[]>([])

    const {
        data: rootFiles,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['github-contents', params.owner, params.repo, params.ref],
        queryFn: async (): Promise<FileItem[]> => {
            const response = await fetch(
                `https://api.github.com/repos/${params.owner}/${params.repo}/contents?ref=${params.ref}`,
            )
            if (!response.ok) throw new Error('Failed to fetch files')
            return response.json()
        },
        enabled: !!(params.owner && params.repo && params.ref),
    })

    useEffect(() => {
        if (rootFiles) {
            setFileTree(rootFiles.map((file: FileItem) => ({ ...file })))
        }
    }, [rootFiles])

    async function fetchFolderContents(folderPath: string): Promise<FileItem[]> {
        const response = await fetch(
            `https://api.github.com/repos/${params.owner}/${params.repo}/contents/${folderPath}?ref=${params.ref}`,
        )
        if (!response.ok) throw new Error('Failed to fetch folder contents')
        return response.json()
    }

    function updateFileTree(
        tree: ExpandableFileItem[],
        targetPath: string,
        children: ExpandableFileItem[],
    ): ExpandableFileItem[] {
        return tree.map((item) => {
            if (item.path === targetPath) {
                return { ...item, children, isLoading: false }
            } else if (item.children) {
                return { ...item, children: updateFileTree(item.children, targetPath, children) }
            }
            return item
        })
    }

    function setFolderLoading(
        tree: ExpandableFileItem[],
        targetPath: string,
        loading: boolean,
    ): ExpandableFileItem[] {
        return tree.map((item) => {
            if (item.path === targetPath) {
                return { ...item, isLoading: loading }
            } else if (item.children) {
                return { ...item, children: setFolderLoading(item.children, targetPath, loading) }
            }
            return item
        })
    }

    async function toggleFolder(folderPath: string) {
        const isExpanded = expandedFolders.has(folderPath)

        if (isExpanded) {
            // Collapse folder
            const newExpanded = new Set(expandedFolders)
            newExpanded.delete(folderPath)
            setExpandedFolders(newExpanded)
            return
        }

        // Expand folder
        const newExpanded = new Set(expandedFolders)
        newExpanded.add(folderPath)
        setExpandedFolders(newExpanded)

        // Check if we already have children loaded
        const findItem = (tree: ExpandableFileItem[], path: string): ExpandableFileItem | null => {
            for (const item of tree) {
                if (item.path === path) return item
                if (item.children) {
                    const found = findItem(item.children, path)
                    if (found) return found
                }
            }
            return null
        }

        const targetItem = findItem(fileTree, folderPath)
        if (!targetItem?.children) {
            // Set loading state
            setFileTree((prev) => setFolderLoading(prev, folderPath, true))

            try {
                const children = await fetchFolderContents(folderPath)
                setFileTree((prev) =>
                    updateFileTree(
                        prev,
                        folderPath,
                        children.map((child) => ({ ...child })),
                    ),
                )
            } catch (error) {
                console.error('Error fetching folder contents:', error)
                setFileTree((prev) => setFolderLoading(prev, folderPath, false))
                // Remove from expanded on error
                newExpanded.delete(folderPath)
                setExpandedFolders(newExpanded)
            }
        }
    }

    function renderFileTree(items: ExpandableFileItem[], depth = 0) {
        return items.map((item) => (
            <div key={item.path} style={{ marginLeft: `${depth * 20}px` }}>
                {item.type === 'dir' ? (
                    <div>
                        <button
                            onClick={() => toggleFolder(item.path)}
                            className="flex items-center w-full text-left hover:bg-gray-200 p-1 rounded"
                        >
                            <span className="mr-1">
                                {item.isLoading
                                    ? '⏳'
                                    : expandedFolders.has(item.path)
                                    ? '▼'
                                    : '▶️'}
                            </span>
                            <span>📁 {item.name}</span>
                        </button>
                        {expandedFolders.has(item.path) && item.children && (
                            <div>{renderFileTree(item.children, depth + 1)}</div>
                        )}
                    </div>
                ) : (
                    <FastNavlink
                        to={`/${params.owner}/${params.repo}/tree/${params.ref}/${item.path}`}
                        className="text-blue-600 hover:underline block p-1 hover:bg-gray-200 rounded"
                    >
                        📄 {item.name}
                    </FastNavlink>
                )}
            </div>
        ))
    }

    if (isLoading) return <div className="p-4">Loading files...</div>
    if (error) return <div className="p-4 text-red-600">Error loading files</div>

    return <div className="font-bold mb-4">{renderFileTree(fileTree)}</div>
}
