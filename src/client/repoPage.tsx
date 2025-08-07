import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import {
    ChevronDownIcon,
    ChevronRightIcon,
    FileDirectoryIcon,
    FileIcon,
} from '@primer/octicons-react'
import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
    useDefined,
    useFirstLoadQuery,
    useGithubParams,
    useMutable,
    useTanstackQuery,
    type GithubParams,
} from './utils'

type FileTreeNode = {
    name: string
    path: string
    isDir: boolean
    children?: FileTreeNode[]
}

function buildFileTree(filePaths: string[]): FileTreeNode[] {
    const root: FileTreeNode[] = []
    const nodeMap = new Map<string, FileTreeNode>()

    // Pre-build directory set for O(1) lookups
    const dirPaths = new Set<string>()
    for (const filePath of filePaths) {
        const parts = filePath.split('/')
        for (let i = 1; i < parts.length; i++) {
            dirPaths.add(parts.slice(0, i).join('/'))
        }
    }

    for (const filePath of filePaths) {
        const parts = filePath.split('/').filter(Boolean)
        let currentPath = ''
        let currentLevel = root

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]!
            currentPath = currentPath ? `${currentPath}/${part}` : part
            const isLastPart = i === parts.length - 1
            const isDir = !isLastPart || dirPaths.has(currentPath)

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

    // In-place sorting to avoid object reconstruction
    function sortNodes(nodes: FileTreeNode[]): void {
        nodes.sort((a, b) => {
            if (a.isDir !== b.isDir) {
                return a.isDir ? -1 : 1
            }
            return a.name.localeCompare(b.name)
        })

        for (const node of nodes) {
            if (node.children) {
                sortNodes(node.children)
            }
        }
    }

    sortNodes(root)
    return root
}

function FileTreeNode({ node, params }: { node: FileTreeNode; params: GithubParams }) {
    const state = useMutable({ expanded: false })
    const navigate = useNavigate()

    let query = useQuery(api.queries.getRepoPage, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: params.refAndPath,
    })
    query = useDefined(query)

    let ref = query?.ref

    if (node.isDir) {
        return (
            <div>
                <button
                    onClick={() => {
                        state.expanded = !state.expanded
                    }}
                    className="flex w-full cursor-pointer items-center rounded p-1 text-left text-gray-700 hover:bg-gray-50"
                >
                    <span className="mr-1 flex-shrink-0">
                        {state.expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    </span>
                    <span className="mr-1">
                        <FileDirectoryIcon />
                    </span>
                    <span className="min-w-0 truncate">{node.name}</span>
                </button>
                {state.expanded && node.children && (
                    <div style={{ marginLeft: '20px' }}>
                        {node.children.map((child) => (
                            <FileTreeNode key={child.path} node={child} params={params} />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <button
            onMouseDown={() => {
                const refName = ref?.name ?? ''
                navigate(`/${params.owner}/${params.repo}/blob/${refName}/${node.path}`)
            }}
            className="flex w-full cursor-pointer items-center rounded p-1 text-left text-gray-700 hover:bg-gray-50"
        >
            <span className="mr-1">
                <FileIcon />
            </span>
            <span className="min-w-0 truncate">{node.name}</span>
        </button>
    )
}

function Sidebar({ preloadedFiles }: { preloadedFiles?: string[] }) {
    let params = useGithubParams()

    let { data: query } = useTanstackQuery(
        convexQuery(api.queries.getRepoPage, {
            owner: params.owner,
            repo: params.repo,
            refAndPath: params.refAndPath,
        }),
    )

    let files = preloadedFiles ?? query?.filenames
    let fileTree = useMemo(() => buildFileTree(files ?? []), [files])

    return (
        <div>
            {/* <RefSelector /> */}
            <div className="p-2">
                {fileTree.map((node) => (
                    <FileTreeNode key={node.path} node={node} params={params} />
                ))}
            </div>
        </div>
    )
}

export function RepoPage() {
    let params = useGithubParams()

    let page = useFirstLoadQuery({
        queryKey: ['repoPage', params.owner, params.repo, params.refAndPath],
        queryFn: async (client) =>
            client.query(api.queries.getRepoPage, {
                owner: params.owner,
                repo: params.repo,
                refAndPath: params.refAndPath,
            }),
    })

    return (
        <div className="flex flex-1">
            <div className="h-full w-60 overflow-y-auto">
                <Sidebar preloadedFiles={page?.filenames}></Sidebar>
            </div>
            <div className="flex-1 overflow-auto">
                <pre>
                    <code>{page?.fileContents}</code>
                </pre>
            </div>
        </div>
    )
}
