import 'github-markdown-css/github-markdown-light.css'

import { useGithubFilePath, useMutable } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { FaChevronDown, FaChevronRight, FaFile, FaFolder, FaSpinner } from 'react-icons/fa'
import { FastNavlink } from './components'
import { fileOptions } from './queryOptions'

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

export function Sidebar() {
    const params = useGithubFilePath()

    const rootFileParams = { ...params, path: '' }
    const rootFilesQuery = useQuery(fileOptions(rootFileParams))

    if (rootFilesQuery.isLoading) {
        return <div className="p-4">Loading files...</div>
    }
    if (rootFilesQuery.error || !rootFilesQuery.data) {
        return <div className="p-4 text-red-600">Error loading files</div>
    }

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
