import 'github-markdown-css/github-markdown-light.css'

import { useGithubFilePath, useMutable } from '@/client/utils'
import { useQuery } from '@tanstack/react-query'
import {
    FaChevronDown,
    FaChevronRight,
    FaFile,
    FaFolder,
    FaSpinner,
    FaCodeBranch,
} from 'react-icons/fa'
import { FastNavlink } from './components'
import { fileOptions, branchesOptions } from './queryOptions'
import { useNavigate } from 'react-router'
import type { Folder, FolderContents } from '@/shared/github-client'

type FileItem = {
    name: string
    path: string
    isDir: boolean
}

function FileNode(props: { file: FileItem }) {
    const params = useGithubFilePath()
    const item = props.file
    const isCurrentPath = item.path === params.path

    return (
        <FastNavlink
            to={`/${params.owner}/${params.repo}/tree/${params.ref}/${item.path}`}
            className={`flex items-center rounded p-1 pl-6 ${
                isCurrentPath ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
            }`}
        >
            <FaFile className="mr-1 flex-shrink-0" />
            <span className="min-w-0 truncate">{item.name}</span>
        </FastNavlink>
    )
}

function FolderNode(props: { file: FileItem }) {
    const params = useGithubFilePath()
    const path = props.file.path
    const item = props.file

    const isCurrentPath = item.path === params.path

    const isInPath = params.path.indexOf(path) === 0

    // update path as the folder will have different path from the current url github file path
    const fileParams = { ...params, path }
    const filesQuery = useQuery(fileOptions(fileParams, isInPath))

    const state = useMutable({
        pressed: isInPath,
        didPress: false,
    })

    let fileItems: FileItem[] = []
    if (filesQuery.data?.type === 'folder') {
        fileItems = filesQuery.data.contents.slice().sort((a, b) => {
            // Folders first, then files
            if (a.isDir !== b.isDir) {
                return a.isDir ? -1 : 1
            }
            // Alphabetical within same type
            return a.name.localeCompare(b.name)
        })
    }

    return (
        <div>
            <button
                onMouseDown={() => {
                    if (!state.pressed && !state.didPress) {
                        filesQuery.refetch()
                        state.didPress = true
                    }

                    state.pressed = !state.pressed
                }}
                className={`flex w-full cursor-pointer items-center rounded p-1 text-left ${
                    isCurrentPath ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                }`}
            >
                <span className="mr-1 flex-shrink-0">
                    {filesQuery.isLoading ? (
                        <FaSpinner className="animate-spin" />
                    ) : state.pressed ? (
                        <FaChevronDown />
                    ) : (
                        <FaChevronRight />
                    )}
                </span>
                <FaFolder className="mr-1 flex-shrink-0" />
                <span className="min-w-0 truncate">{item.name}</span>
            </button>
            {state.pressed &&
                fileItems?.map((item) => (
                    <div key={item.path} style={{ marginLeft: `${1 * 12}px` }}>
                        {item.isDir ? (
                            <FolderNode file={item}></FolderNode>
                        ) : (
                            <FileNode file={item}></FileNode>
                        )}
                    </div>
                ))}
        </div>
    )
}

function RefDropdown() {
    const params = useGithubFilePath()
    const navigate = useNavigate()
    const branchesQuery = useQuery(branchesOptions(params.owner, params.repo))

    const state = useMutable({
        isOpen: false,
        searchTerm: '',
    })

    if (branchesQuery.isLoading) {
        return (
            <div className="mb-4 flex items-center gap-2 rounded border p-2">
                <FaCodeBranch className="text-gray-500" />
                <span className="text-sm text-gray-600">Loading branches...</span>
            </div>
        )
    }

    if (branchesQuery.error || !branchesQuery.data) {
        return (
            <div className="mb-4 flex items-center gap-2 rounded border p-2">
                <FaCodeBranch className="text-gray-500" />
                <span className="text-sm text-red-600">Error loading branches</span>
            </div>
        )
    }

    const { branches, defaultBranch } = branchesQuery.data

    // Sort branches with default branch first, then main/master, then alphabetically
    const sortedBranches = [...branches].sort((a, b) => {
        const isADefault = a.name === defaultBranch
        const isBDefault = b.name === defaultBranch
        const isAMain = a.name === 'main' || a.name === 'master'
        const isBMain = b.name === 'main' || b.name === 'master'

        // Default branch always first
        if (isADefault && !isBDefault) return -1
        if (!isADefault && isBDefault) return 1

        // If no default branch info, prioritize main/master
        if (!defaultBranch) {
            if (isAMain && !isBMain) return -1
            if (!isAMain && isBMain) return 1
            if (isAMain && isBMain) {
                return a.name === 'main' ? -1 : 1 // main before master
            }
        }

        return a.name.localeCompare(b.name)
    })

    const filteredBranches = sortedBranches.filter((branch) =>
        branch.name.toLowerCase().includes(state.searchTerm.toLowerCase()),
    )

    const handleBranchSelect = (branchName: string) => {
        state.isOpen = false
        state.searchTerm = ''
        navigate(`/${params.owner}/${params.repo}/tree/${branchName}/${params.path}`)
    }

    return (
        <div className="relative mb-4">
            <button
                onClick={() => {
                    state.isOpen = !state.isOpen
                }}
                className="flex w-full items-center justify-between rounded border p-2 text-left hover:bg-gray-50"
            >
                <div className="flex items-center gap-2">
                    <FaCodeBranch className="text-gray-500" />
                    <span className="text-sm font-medium">{params.ref}</span>
                </div>
                <FaChevronDown
                    className={`text-gray-400 transition-transform ${state.isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {state.isOpen && (
                <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-hidden rounded border bg-white shadow-lg">
                    <div className="border-b p-2">
                        <input
                            type="text"
                            placeholder="Find a branch..."
                            value={state.searchTerm}
                            onChange={(e) => {
                                state.searchTerm = e.target.value
                            }}
                            className="w-full rounded border p-1 text-sm"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filteredBranches.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">No branches found</div>
                        ) : (
                            filteredBranches.map((branch) => (
                                <button
                                    key={branch.name}
                                    onClick={() => handleBranchSelect(branch.name)}
                                    className={`w-full p-2 text-left text-sm hover:bg-gray-50 ${
                                        branch.name === params.ref ? 'bg-blue-50 text-blue-700' : ''
                                    }`}
                                >
                                    {branch.name}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export function Sidebar(props: { ref: string; path: string }) {
    const params = useGithubFilePath()

    const rootFileParams = {
        ...params,

        // Setting the path to '' makes tanstack query see the same query for
        // different files in the same repository. That way we don't a request
        // for files in the sidebar for each file change.
        path: '',
    }
    const rootFilesQuery = useQuery(fileOptions(rootFileParams))

    if (rootFilesQuery.isLoading) {
        return <div className="p-4">Loading files...</div>
    }
    if (rootFilesQuery.error) {
        return <div className="p-4 text-red-600">Error loading files</div>
    }

    if (!rootFilesQuery.data) return null
    if (rootFilesQuery.data.type === 'file') return null

    const fileItems = rootFilesQuery.data.contents.slice().sort((a, b) => {
        // Folders first, then files
        if (a.isDir !== b.isDir) {
            return a.isDir ? -1 : 1
        }
        // Alphabetical within same type
        return a.name.localeCompare(b.name)
    })

    return (
        <div>
            <RefDropdown />
            {fileItems.map((item) => (
                <div key={item.path}>
                    {item.isDir ? (
                        <FolderNode file={item}></FolderNode>
                    ) : (
                        <FileNode file={item}></FileNode>
                    )}
                </div>
            ))}
        </div>
    )
}
