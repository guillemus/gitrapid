import 'github-markdown-css/github-markdown-light.css'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FaChevronDown, FaChevronRight, FaFolder, FaFile, FaSpinner } from 'react-icons/fa'
import { useNavigate } from 'react-router'
import { FastNavlink } from './components'
import { githubClient } from './lib/github-client'
import { unwrap, useGithubFilePath } from './lib/utils'
import { queryClient } from './queryClient'

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
    const params = useGithubFilePath()
    const navigate = useNavigate()

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [folderContents, setFolderContents] = useState<Map<string, ExpandableFileItem[]>>(
        new Map(),
    )
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set())

    let rootFileParams = { ...params, path: '' }

    const githubContentsQuery = useQuery({
        queryKey: ['github-root-files', rootFileParams],
        queryFn: async (): Promise<FileItem[]> => {
            const data = await githubClient.getFileContentByAPI(rootFileParams).then(unwrap)

            // Handle both array and single file responses
            if (Array.isArray(data)) {
                return data as FileItem[]
            }
            return [data] as FileItem[]
        },
    })

    function buildFileTree(items: FileItem[]): ExpandableFileItem[] {
        return items
            .sort((a, b) => {
                // Folders first, then files
                if (a.type !== b.type) {
                    return a.type === 'dir' ? -1 : 1
                }
                // Alphabetical within same type
                return a.name.localeCompare(b.name)
            })
            .map((file: FileItem) => ({
                ...file,
                children: folderContents.get(file.path),
                isLoading: loadingFolders.has(file.path),
            }))
    }

    function populateChildren(items: ExpandableFileItem[]): ExpandableFileItem[] {
        return items.map((item) => ({
            ...item,
            children: item.children
                ? populateChildren(item.children)
                : folderContents.get(item.path)?.map((child) => ({
                      ...child,
                      children: folderContents.get(child.path),
                      isLoading: loadingFolders.has(child.path),
                  })),
        }))
    }

    const fileTree = githubContentsQuery.data
        ? populateChildren(buildFileTree(githubContentsQuery.data))
        : []

    async function fetchFolderContents(folderPath: string): Promise<FileItem[]> {
        let fileParams = {
            ...params,
            path: folderPath,
        }

        return queryClient.fetchQuery({
            queryKey: ['github-files', fileParams],
            queryFn: async () => {
                const data = await githubClient.getFileContentByAPI(fileParams).then(unwrap)
                // Handle both array and single file responses
                if (Array.isArray(data)) {
                    return data as FileItem[]
                }
                return [data] as FileItem[]
            },
        })
    }

    async function toggleFolder(folderPath: string) {
        const isExpanded = expandedFolders.has(folderPath)

        // Navigate to folder URL
        navigate(`/${params.owner}/${params.repo}/tree/${params.ref}/${folderPath}`)

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
            setLoadingFolders((prev) => new Set([...prev, folderPath]))

            try {
                const children = await fetchFolderContents(folderPath)
                const sortedChildren = [...children].sort((a, b) => {
                    // Folders first, then files
                    if (a.type !== b.type) {
                        return a.type === 'dir' ? -1 : 1
                    }
                    // Alphabetical within same type
                    return a.name.localeCompare(b.name)
                })
                setFolderContents(
                    (prev) =>
                        new Map([
                            ...prev,
                            [folderPath, sortedChildren.map((child) => ({ ...child }))],
                        ]),
                )
                setLoadingFolders((prev) => {
                    const next = new Set(prev)
                    next.delete(folderPath)
                    return next
                })
            } catch (error) {
                console.error('Error fetching folder contents:', error)
                setLoadingFolders((prev) => {
                    const next = new Set(prev)
                    next.delete(folderPath)
                    return next
                })
                // Remove from expanded on error
                newExpanded.delete(folderPath)
                setExpandedFolders(newExpanded)
            }
        }
    }

    function renderFileTree(items: ExpandableFileItem[], depth = 0) {
        return items.map((item) => {
            const isCurrentPath = item.path === params.path

            return (
                <div key={item.path} style={{ marginLeft: `${depth * 12}px` }}>
                    {item.type === 'dir' ? (
                        <div>
                            <button
                                onMouseDown={() => toggleFolder(item.path)}
                                className={`flex w-full items-center rounded p-1 text-left ${
                                    isCurrentPath ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                                }`}
                            >
                                <span className="mr-1 flex-shrink-0">
                                    {item.isLoading ? (
                                        <FaSpinner className="animate-spin" />
                                    ) : expandedFolders.has(item.path) ? (
                                        <FaChevronDown />
                                    ) : (
                                        <FaChevronRight />
                                    )}
                                </span>
                                <FaFolder className="mr-1 flex-shrink-0" />
                                <span className="min-w-0 truncate">{item.name}</span>
                            </button>
                            {expandedFolders.has(item.path) && item.children && (
                                <div>{renderFileTree(item.children, depth + 1)}</div>
                            )}
                        </div>
                    ) : (
                        <FastNavlink
                            to={`/${params.owner}/${params.repo}/tree/${params.ref}/${item.path}`}
                            className={`flex items-center rounded p-1 pl-6 ${
                                isCurrentPath ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                            }`}
                        >
                            <FaFile className="mr-1 flex-shrink-0" />
                            <span className="min-w-0 truncate">{item.name}</span>
                        </FastNavlink>
                    )}
                </div>
            )
        })
    }

    if (githubContentsQuery.isLoading) {
        return <div className="p-4">Loading files...</div>
    }
    if (githubContentsQuery.error) {
        return <div className="p-4 text-red-600">Error loading files</div>
    }

    return <div className="mb-4">{renderFileTree(fileTree)}</div>
}
