import type { GetContentResponse } from './github-client'

export function transformFileContentsResponse(fileContents: GetContentResponse) {
    if (Array.isArray(fileContents)) {
        type FolderContents = {
            name: string
            path: string
            isDir: boolean
        }
        const contents: FolderContents[] = []
        for (const file of fileContents) {
            contents.push({
                isDir: file.type === 'dir',
                name: file.name,
                path: file.path,
            })
        }

        return { type: 'folder', contents: contents } as const
    }

    if (fileContents.type === 'file') {
        return {
            type: 'file',
            name: fileContents.name,
            path: fileContents.path,
            contents: fileContents.content,
        } as const
    }

    return null
}

export type Success<T> = {
    data: T
    error: null
}

export type Failure<E> = {
    data: null
    error: E
}

export type Result<T, E = Error> = Success<T> | Failure<E>

export function ok<T>(val: T): Success<T> {
    return { data: val, error: null }
}

export function err(msg: string): Failure<Error> {
    return { data: null, error: new Error(msg) }
}

export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
    try {
        const data = await promise
        return { data, error: null }
    } catch (error) {
        return { data: null, error: error as E }
    }
}

export function unwrap<T, E>(res: Result<T, E>): T {
    if (res.error) {
        throw res.error
    }

    return res.data as T
}
