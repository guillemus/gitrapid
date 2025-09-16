export type Ok<T = null> = { isErr: false; val: T }
export type Err<E = string> = { isErr: true; err: E }
export type Result<T, E = string> = Ok<T> | Err<E>
export type ResultAsync<T = null, E = string> = Promise<Result<T, E>>

declare global {
    /**
     * Result type for actions and mutations. This is a convenience type to shorten
     * as much as possible return types
     */
    export type R<T = null, E = string> = Promise<Result<T, E>>
}

/**
 * Convenient utility to create an Ok.
 */
export function ok(): Ok
export function ok<T>(val: T): Ok<T>
export function ok<T>(val?: T): Ok<T | null> {
    return { isErr: false, val: (val ?? null) as T | null }
}

/**
 * Convenient utility to create an Err.
 */
export function err<E extends string = string>(msg: E): Err<E> {
    return { isErr: true, err: msg }
}

export function wrap(context: string, err: Err<string>): Err<string> {
    return { isErr: true, err: `${context}\n\t- ${err.err}` }
}

/**
 * Try to run a promise and return a Result.
 */
export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
    try {
        let result = await promise
        return ok(result)
    } catch (error) {
        // @ts-expect-error: if it has a `message` property it is quite probable
        // that it is an error
        if (error?.message) return err(String(error.message))

        return err(String(error))
    }
}

/**
 * Unwraps a Result. Use this to throw an error, or for compatibility with other
 * libraries / frameworks that expect thrown exceptions.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (result.isErr) {
        if (typeof result.err === 'string') {
            throw new Error(result.err)
        }
        throw result.err
    }

    return result.val
}
