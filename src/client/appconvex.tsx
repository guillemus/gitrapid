import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { QueryClientProvider } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { ConvexProvider, ConvexReactClient, useAction, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, useNavigate, useParams } from 'react-router'
import { CodeBlock } from './code-block'
import { queryClient } from './queryClient'
import { useMutable, useTanstackQuery } from './utils'

type GithubParams = {
    owner: string
    repo: string
    refAndPath: string
}

function useGithubParams(): GithubParams {
    let params = useParams()

    let owner = params.owner
    if (!owner) throw new Error(':owner required')
    let repo = params.repo
    if (!repo) throw new Error(':repo required')

    let refAndPath = params['*'] ?? ''

    return { owner, repo, refAndPath }
}

type FileTreeNode = {
    name: string
    path: string
    isDir: boolean
    children?: FileTreeNode[]
}

function buildFileTree(filePaths: string[]): FileTreeNode[] {
    const root: FileTreeNode[] = []
    const nodeMap = new Map<string, FileTreeNode>()

    // Sort paths to ensure parent directories are processed before children
    const sortedPaths = filePaths.slice().sort()

    for (const filePath of sortedPaths) {
        const parts = filePath.split('/').filter(Boolean)
        let currentPath = ''
        let currentLevel = root

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]!
            currentPath = currentPath ? `${currentPath}/${part}` : part
            const isLastPart = i === parts.length - 1
            const isDir = !isLastPart || filePaths.some((p) => p.startsWith(`${currentPath}/`))

            let node = nodeMap.get(currentPath)
            if (!node) {
                node = {
                    name: part,
                    path: currentPath,
                    isDir,
                    children: isDir ? [] : undefined,
                }
                nodeMap.set(currentPath, node)
                currentLevel.push(node)
            }

            if (node.isDir && node.children) {
                currentLevel = node.children
            }
        }
    }

    // Sort each level: folders first, then alphabetically
    function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
        return nodes
            .sort((a, b) => {
                // Folders first
                if (a.isDir !== b.isDir) {
                    return a.isDir ? -1 : 1
                }
                // Alphabetical within same type
                return a.name.localeCompare(b.name)
            })
            .map((node) => ({
                ...node,
                children: node.children ? sortNodes(node.children) : undefined,
            }))
    }

    return sortNodes(root)
}

function FileTreeNode({
    node,
    params,
    commitId,
}: {
    commitId?: Id<'commits'>
    node: FileTreeNode
    params: GithubParams
}) {
    const state = useMutable({ expanded: false })
    const navigate = useNavigate()

    if (node.isDir) {
        return (
            <div>
                <button
                    onClick={() => {
                        state.expanded = !state.expanded
                    }}
                    className="flex w-full cursor-pointer items-center rounded p-1 text-left text-gray-700 hover:bg-gray-50"
                >
                    <span className="mr-1 flex-shrink-0">{state.expanded ? '▼' : '▶'}</span>
                    <span className="mr-1">📁</span>
                    <span className="min-w-0 truncate">{node.name}</span>
                </button>
                {state.expanded && node.children && (
                    <div style={{ marginLeft: '12px' }}>
                        {node.children.map((child) => (
                            <FileTreeNode
                                commitId={commitId}
                                key={child.path}
                                node={child}
                                params={params}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <button
            onMouseDown={() => {
                // Extract ref from refAndPath (first segment before first slash or the whole thing)
                const refParts = params.refAndPath.split('/')
                const ref = refParts[0] || 'main'
                navigate(`/${params.owner}/${params.repo}/blob/${ref}/${node.path}`)
            }}
            className="flex w-full cursor-pointer items-center rounded p-1 text-left text-gray-700 hover:bg-gray-50"
        >
            <span className="mr-1">📄</span>
            <span className="min-w-0 truncate">{node.name}</span>
        </button>
    )
}

type SidebarProps = {
    commitId?: Id<'commits'>
    files?: string[]
}

function Sidebar({ files, commitId }: SidebarProps) {
    let params = useGithubParams()
    const fileTree = files ? buildFileTree(files) : []

    return (
        <div className="p-2">
            {fileTree.map((node) => (
                <FileTreeNode commitId={commitId} key={node.path} node={node} params={params} />
            ))}
        </div>
    )
}

function FilePicker({
    files,
    onClose,
    params,
}: {
    files: string[]
    onClose: () => void
    params: GithubParams
}) {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')

    const openFile = (path: string) => {
        const refParts = params.refAndPath.split('/')
        const ref = refParts[0] || 'main'
        navigate(`/${params.owner}/${params.repo}/blob/${ref}/${path}`)
        onClose()
    }

    const q = query.trim().toLowerCase()
    const filtered = q ? files.filter((f) => f.toLowerCase().includes(q)) : files

    // Close on Escape
    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', esc)
        return () => window.removeEventListener('keydown', esc)
    }, [onClose])

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-lg rounded bg-white shadow-xl">
                <Command className="p-2">
                    <Command.Input
                        autoFocus
                        placeholder="Search files…"
                        className="w-full border-b px-2 py-2 text-lg outline-none"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <Command.List className="max-h-80 overflow-y-auto">
                        {filtered.map((path) => (
                            <Command.Item
                                key={path}
                                value={path}
                                onSelect={() => openFile(path)}
                                className="cursor-pointer px-3 py-1.5 data-[selected=true]:bg-blue-100"
                            >
                                {path}
                            </Command.Item>
                        ))}
                    </Command.List>
                </Command>
            </div>
        </div>
    )
}

function GitRapid() {
    let params = useGithubParams()

    let file = useQuery(api.functions.getFile, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: params.refAndPath,
    })
    let saveFile = useAction(api.actions.fetchFileFromGithub)

    useEffect(() => {
        if (file?.type === 'file_not_found') {
            saveFile({
                commitId: file.commitId,
                owner: params.owner,
                repo: params.repo,
                ref: file.ref,
                path: file.path,
            })
        }
    }, [file, params.owner, params.repo, saveFile])

    let commitIdRef = useRef<Id<'commits'>>(undefined)
    if (file?.type === 'success') {
        commitIdRef.current = file.commitId
    }
    let commitId = commitIdRef.current

    const [showPicker, setShowPicker] = useState(false)

    const { data: files } = useTanstackQuery({
        queryKey: ['tree', commitId],
        queryFn: async () => {
            if (!commitId) return []
            const res = await convex.query(api.functions.getFiles, { commitId })
            return res?.files ?? []
        },
        enabled: !!commitId,
    })

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const mod = e.ctrlKey || e.metaKey
            if (mod && e.key.toLowerCase() === 'p') {
                e.preventDefault()
                setShowPicker(true)
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [files])

    return (
        <div className="flex h-screen">
            <div className="h-full w-60 overflow-y-auto">
                <Sidebar commitId={commitId} files={files}></Sidebar>
            </div>
            <div className="flex-1 overflow-auto">
                {file?.type === 'success' && <CodeBlock code={file.contents}></CodeBlock>}
            </div>

            {showPicker && files && (
                <FilePicker files={files} onClose={() => setShowPicker(false)} params={params} />
            )}
        </div>
    )
}

function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/:owner/:repo" element={<GitRapid />} />
                <Route path="/:owner/:repo/tree/*" element={<GitRapid />} />
                <Route path="/:owner/:repo/blob/*" element={<GitRapid />} />
            </Routes>
        </BrowserRouter>
    )
}

const convex = new ConvexReactClient(import.meta.env.PUBLIC_CONVEX_URL!)

export function App() {
    return (
        <ConvexProvider client={convex}>
            <QueryClientProvider client={queryClient}>
                <Router></Router>
            </QueryClientProvider>
        </ConvexProvider>
    )
}
