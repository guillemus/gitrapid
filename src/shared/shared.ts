export type Success<T> = {
    data: T
    error: null
}

export type Failure<E> = {
    data: null
    error: E
}

export type Result<T, E = Error> = Success<T> | Failure<E>
export type ResultP<T, E = Error> = Promise<Result<T, E>>

export function ok<T>(val: T): Success<T> {
    return { data: val, error: null }
}

export function err(msg: string): Failure<Error> {
    return { data: null, error: new Error(msg) }
}

export function failure<T>(val: T): Failure<T> {
    return { data: null, error: val }
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
