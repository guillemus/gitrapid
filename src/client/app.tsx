import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import {
    ChevronDownIcon,
    ChevronRightIcon,
    FileDirectoryIcon,
    FileIcon,
    GitBranchIcon,
    SearchIcon,
    TagIcon,
} from '@primer/octicons-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ConvexProvider, useQuery } from 'convex/react'
import { useEffect, useMemo } from 'react'
import { BrowserRouter, Route, Routes, useNavigate, useParams } from 'react-router'
import { CodeBlock } from './codeBlock'
import { convex, convexHttp, queryClient } from './convex'
import { useDefined, useMutable, useTanstackQuery } from './utils'

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

    let refsAndCurrent
    refsAndCurrent = useQuery(api.functions.getRefsAndCurrent, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: params.refAndPath,
    })
    refsAndCurrent = useDefined(refsAndCurrent)

    let ref = refsAndCurrent?.ref
    let fetchFileOptions = useFetchFileOptions(`${ref}/${node.path}`)

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
            onMouseEnter={() => {
                queryClient.prefetchQuery(fetchFileOptions)
            }}
            onMouseDown={() => {
                navigate(`/${params.owner}/${params.repo}/blob/${ref}/${node.path}`)
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

function RefSelector() {
    let params = useGithubParams()

    let refsAndCurrent
    refsAndCurrent = useQuery(api.functions.getRefsAndCurrent, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: params.refAndPath,
    })
    refsAndCurrent = useDefined(refsAndCurrent)

    let branches = refsAndCurrent?.refs.filter((r) => !r.isTag) ?? []
    let tags = refsAndCurrent?.refs.filter((r) => r.isTag) ?? []

    let selectorState = useMutable({
        showDropdown: false,
        searchQuery: '',
        activeTab: 'branches' as 'branches' | 'tags',
    })

    const navigate = useNavigate()

    const currentData = selectorState.activeTab === 'branches' ? branches : tags
    const filteredData = selectorState.searchQuery.trim()
        ? currentData.filter((item) =>
              item.ref.toLowerCase().includes(selectorState.searchQuery.toLowerCase()),
          )
        : currentData

    function selectRef(ref: string) {
        navigate(`/${params.owner}/${params.repo}/blob/${ref}`)
        selectorState.showDropdown = false
        selectorState.searchQuery = ''
    }

    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                selectorState.showDropdown = false
            }
        }

        if (selectorState.showDropdown) {
            document.addEventListener('keydown', handleEscape)
            return () => document.removeEventListener('keydown', handleEscape)
        }
    }, [selectorState.showDropdown])

    if (!refsAndCurrent) return null

    return (
        <div className="relative p-2 pb-0">
            <button
                onClick={() => (selectorState.showDropdown = !selectorState.showDropdown)}
                className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
                <div className="flex items-center">
                    <GitBranchIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">{refsAndCurrent?.ref ?? ''}</span>
                </div>
                <ChevronDownIcon className="h-4 w-4" />
            </button>

            {selectorState.showDropdown && (
                <div className="absolute top-12 right-2 left-2 z-50 rounded border border-gray-300 bg-white shadow-lg">
                    <div className="p-2">
                        <div className="flex items-center rounded border border-gray-300 px-2 py-1">
                            <SearchIcon className="mr-2 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder={`Find a ${selectorState.activeTab === 'branches' ? 'branch' : 'tag'}...`}
                                value={selectorState.searchQuery}
                                onChange={(e) => (selectorState.searchQuery = e.target.value)}
                                className="flex-1 text-sm outline-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200">
                        <div className="flex border-b border-gray-200">
                            <button
                                onClick={() => (selectorState.activeTab = 'branches')}
                                className={`flex-1 px-3 py-2 text-xs font-semibold ${
                                    selectorState.activeTab === 'branches'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                Branches
                            </button>
                            <button
                                onClick={() => (selectorState.activeTab = 'tags')}
                                className={`flex-1 px-3 py-2 text-xs font-semibold ${
                                    selectorState.activeTab === 'tags'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                Tags
                            </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto">
                            {filteredData.map((item) => (
                                <button
                                    key={item._id}
                                    onClick={() => selectRef(item.ref)}
                                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-blue-50"
                                >
                                    <div className="flex items-center">
                                        {selectorState.activeTab === 'tags' && (
                                            <TagIcon className="mr-2 h-4 w-4 text-gray-500" />
                                        )}
                                        <span className="truncate">{item.ref}</span>
                                    </div>
                                    {item.ref === refsAndCurrent?.ref && (
                                        <span className="text-xs text-gray-500">current</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function Sidebar({ preloadedFiles }: { preloadedFiles?: string[] }) {
    let params = useGithubParams()

    let files
    files = useQuery(api.functions.filesAndCommitIdFromPath, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: params.refAndPath,
    })
    files = useDefined(files)
    let commitId = files?.commitId

    files = preloadedFiles ?? files?.files

    let fileTree = useMemo(() => buildFileTree(files ?? []), [files])

    return (
        <div>
            {/* <RefSelector /> */}
            <div className="p-2">
                {fileTree.map((node) => (
                    <FileTreeNode commitId={commitId} key={node.path} node={node} params={params} />
                ))}
            </div>
        </div>
    )
}

function GitRapid() {
    let params = useGithubParams()

    let loaded = useMutable({ value: false })
    let page = useTanstackQuery({
        queryKey: ['repoPage', params.owner, params.repo, params.refAndPath],
        queryFn: async () => {
            let query = await convexHttp.query(api.functions.getRepoPage, {
                owner: params.owner,
                repo: params.repo,
                refAndPath: params.refAndPath,
            })

            loaded.value = true

            return query
        },
        enabled: !loaded.value,
    })

    return (
        <div className="flex h-screen">
            <div className="h-full w-60 overflow-y-auto">
                <Sidebar preloadedFiles={page.data?.files}></Sidebar>
            </div>
            <div className="flex-1 overflow-auto">
                <Code preloadedFileContents={page.data?.fileContents}></Code>
            </div>
        </div>
    )
}

function useFetchFileOptions(refAndPath: string) {
    let params = useGithubParams()
    return convexQuery(api.functions.getFile, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: refAndPath,
    })
}

function Code(props: { preloadedFileContents?: string }) {
    let params = useGithubParams()
    let { data: file } = useTanstackQuery(useFetchFileOptions(params.refAndPath))

    // fixme: should be parsed, this is bad.
    let contents: any = props.preloadedFileContents ?? file

    return (
        <div>
            <CodeBlock code={contents ?? ''}></CodeBlock>
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

export function App() {
    return (
        <ConvexProvider client={convex}>
            <QueryClientProvider client={queryClient}>
                <Router></Router>
                <ReactQueryDevtools client={queryClient}></ReactQueryDevtools>
            </QueryClientProvider>
        </ConvexProvider>
    )
}
