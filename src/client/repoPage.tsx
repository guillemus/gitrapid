import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import {
    ChevronDownIcon,
    ChevronRightIcon,
    FileDirectoryIcon,
    FileIcon,
} from '@primer/octicons-react'
import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CodeBlock } from './codeBlock'
import { queryClient, useConvexHttp } from './convex'
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

    let query = useQuery(api.functions.getRepoPage, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: params.refAndPath,
    })
    query = useDefined(query)

    let ref = query?.ref

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

function Sidebar({ preloadedFiles }: { preloadedFiles?: string[] }) {
    let params = useGithubParams()

    let query = useQuery(api.functions.getRepoPage, {
        owner: params.owner,
        repo: params.repo,
        refAndPath: params.refAndPath,
    })
    query = useDefined(query)

    let files = preloadedFiles ?? query?.files
    let commitId = query?.commitId

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

export function RepoPage() {
    let params = useGithubParams()

    const convexHttp = useConvexHttp()

    let loaded = useMutable({ value: false })
    let page = useTanstackQuery({
        queryKey: ['repoPage', params.owner, params.repo, params.refAndPath],
        queryFn: async () => {
            if (!convexHttp) return

            let query = await convexHttp.query(api.functions.getRepoPage, {
                owner: params.owner,
                repo: params.repo,
                refAndPath: params.refAndPath,
            })

            loaded.value = true

            return query
        },
        enabled: !loaded.value && !!convexHttp,
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
