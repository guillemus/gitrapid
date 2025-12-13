import { RefSwitcher } from '@/components/ref-switcher'
import { Skeleton } from '@/components/ui/skeleton'
import { qc } from '@/lib'
import type { TreeItem } from '@/server/router'
import { trpc } from '@/server/trpc-client'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react'
import { createContext, useContext, useMemo, useState } from 'react'
import z from 'zod'

let search = z.object({
    ref: z.string().optional(),
    path: z.string().optional(),
})

export const Route = createFileRoute('/$owner/$repo/')({
    validateSearch: search,
    loaderDeps: ({ search }) => ({ search }),
    loader({ params, deps: { search }, context: { queryClient } }) {
        void queryClient.prefetchQuery(
            qc.fileTree({ owner: params.owner, repo: params.repo, ref: search.ref }),
        )
        void queryClient.prefetchQuery(
            qc.file({
                owner: params.owner,
                repo: params.repo,
                ref: search.ref,
                path: search.path,
            }),
        )
    },
    component: CodePage,
})

type TreeContextValue = {
    expandedPaths: Set<string>
    toggleExpanded: (path: string) => void
    selectFile: (path: string) => void
    preloadFile: (path: string) => void
    selectedPath?: string
}

const TreeContext = createContext<TreeContextValue | null>(null)

function useTreeContext() {
    const ctx = useContext(TreeContext)
    if (!ctx) throw new Error('useTreeContext must be used within TreeContext')
    return ctx
}

function getAncestorPaths(path: string): string[] {
    const parts = path.split('/')
    const ancestors: string[] = []
    for (let i = 1; i < parts.length; i++) {
        ancestors.push(parts.slice(0, i).join('/'))
    }
    return ancestors
}

function CodePage() {
    return (
        <div className="flex flex-1">
            <FileTree />
            <FileViewer />
        </div>
    )
}

function FileTree() {
    const params = Route.useParams()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()

    const tree = useQuery(qc.fileTree({ owner: params.owner, repo: params.repo, ref: search.ref }))
    const refs = useQuery(qc.refs({ owner: params.owner, repo: params.repo }))
    const repoMeta = useQuery(trpc.getRepositoryMetadata.queryOptions(params))

    const initialExpanded = useMemo(() => {
        if (!search.path) {
            return new Set<string>()
        }
        return new Set(getAncestorPaths(search.path))
    }, [])

    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(initialExpanded)

    const toggleExpanded = (path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }

    const selectFile = (path: string) => {
        const ancestors = getAncestorPaths(path)
        setExpandedPaths((prev) => {
            const next = new Set(prev)
            for (const ancestor of ancestors) {
                next.add(ancestor)
            }
            return next
        })
        void navigate({ search: { ...search, path } })
    }

    let router = useRouter()
    const preloadFile = (path: string) => {
        void router.preloadRoute({ to: '.', search: { ...search, path: path } })
    }

    const ctxValue: TreeContextValue = {
        expandedPaths,
        toggleExpanded,
        selectFile,
        preloadFile,

        selectedPath: search.path,
    }

    if (tree.isPending) {
        return (
            <div className="w-80 border-r border-border p-4 overflow-y-auto">
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-6 w-5/6 mb-2" />
            </div>
        )
    }

    if (tree.isError) {
        return (
            <div className="w-80 border-r border-border p-4">
                <div className="text-red-500">Error loading file tree</div>
            </div>
        )
    }

    const treeData = buildTree(tree.data)

    const handleRefSelect = (ref: string) => {
        void navigate({ search: { ref, path: undefined } })
    }

    return (
        <TreeContext.Provider value={ctxValue}>
            <div className="w-80 border-r border-border sticky top-0 h-screen overflow-y-auto">
                <div className="p-4">
                    {refs.data && repoMeta.data && (
                        <div className="mb-4">
                            <RefSwitcher
                                branches={refs.data.branches}
                                tags={refs.data.tags}
                                defaultBranch={repoMeta.data.defaultBranch}
                                currentRef={search.ref}
                                onSelect={handleRefSelect}
                            />
                        </div>
                    )}
                    <TreeNode node={treeData} depth={0} />
                </div>
            </div>
        </TreeContext.Provider>
    )
}

type TreeNodeData = {
    name: string
    path: string
    type: 'file' | 'dir'
    children?: TreeNodeData[]
}

function buildTree(items: TreeItem[]): TreeNodeData {
    const root: TreeNodeData = { name: '', path: '', type: 'dir', children: [] }

    for (const item of items) {
        const parts = item.path.split('/')
        let current: TreeNodeData = root

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            if (!part) continue

            const isLast = i === parts.length - 1

            if (!current.children) {
                current.children = []
            }

            let child = current.children.find((c) => c.name === part)

            if (!child) {
                const newChild: TreeNodeData = {
                    name: part,
                    path: parts.slice(0, i + 1).join('/'),
                    type: isLast && item.type === 'blob' ? 'file' : 'dir',
                    children: isLast && item.type === 'blob' ? undefined : [],
                }
                current.children.push(newChild)
                current = newChild
            } else {
                current = child
            }
        }
    }

    function sortChildren(node: TreeNodeData) {
        if (node.children) {
            node.children.sort((a, b) => {
                if (a.type === b.type) {
                    return a.name.localeCompare(b.name)
                }
                return a.type === 'dir' ? -1 : 1
            })
            for (const child of node.children) {
                sortChildren(child)
            }
        }
    }

    sortChildren(root)

    return root
}

function TreeNode(props: { node: TreeNodeData; depth: number }) {
    const ctx = useTreeContext()
    const expanded = ctx.expandedPaths.has(props.node.path)

    if (props.node.type === 'file') {
        const isSelected = ctx.selectedPath === props.node.path
        return (
            <div
                className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-accent ${isSelected ? 'bg-secondary' : ''}`}
                style={{ paddingLeft: `${props.depth * 12 + 8 + 14 + 8}px` }}
                onClick={() => ctx.selectFile(props.node.path)}
                onMouseDown={() => ctx.preloadFile(props.node.path)}
                title={props.node.path}
            >
                <File size={16} className="text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{props.node.name}</span>
            </div>
        )
    }

    // Root node (empty path) renders children directly without wrapper
    if (props.node.path === '' && props.node.children) {
        return (
            <>
                {props.node.children.map((child) => (
                    <TreeNode key={child.path} node={child} depth={0} />
                ))}
            </>
        )
    }

    return (
        <div>
            <div
                className="flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-accent"
                style={{ paddingLeft: `${props.depth * 12 + 8}px` }}
                onClick={() => ctx.toggleExpanded(props.node.path)}
                onMouseDown={() => ctx.preloadFile(props.node.path)}
                title={props.node.path}
            >
                {expanded ? (
                    <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                ) : (
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                )}
                <Folder size={16} className="text-muted-foreground shrink-0" fill="currentColor" />
                <span className="text-sm font-medium truncate">{props.node.name}</span>
            </div>
            {expanded && props.node.children && (
                <div>
                    {props.node.children.map((child) => (
                        <TreeNode key={child.path} node={child} depth={props.depth + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

function FileViewer() {
    const params = Route.useParams()
    const search = Route.useSearch()

    const file = useQuery(
        qc.file({
            owner: params.owner,
            repo: params.repo,
            ref: search.ref,
            path: search.path,
        }),
    )

    if (file.isPending) {
        return (
            <div className="flex-1 p-6">
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-3/4 mb-2" />
            </div>
        )
    }

    if (file.isError) {
        return (
            <div className="flex-1 p-6">
                <div className="text-red-500">Error loading file</div>
            </div>
        )
    }

    if (!file.data) {
        return (
            <div className="flex-1 p-6">
                <div className="text-muted-foreground">Select a file to view</div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="p-6">
                <div className="bg-muted px-4 py-2 rounded-t border border-b-0 border-border">
                    <span className="font-mono text-sm font-semibold">{file.data.path}</span>
                </div>
                <div className="bg-card border border-border rounded-b overflow-x-auto">
                    <pre className="p-4 text-sm font-mono whitespace-pre">{file.data.content}</pre>
                </div>
            </div>
        </div>
    )
}
