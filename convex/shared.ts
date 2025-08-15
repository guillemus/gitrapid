export type Ok<T = null> = { isErr: false; val: T }
export type Err<E = string> = { isErr: true; error: E }
export type Result<T, E = string> = Ok<T> | Err<E>
export type ResultAsync<T = null> = Promise<Result<T, string>>

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
export function err<E>(msg: E): Err<E> {
    return { isErr: true, error: msg }
}

/**
 * Wraps an error with a context. While we could just use `err`, when doing error wrapping we could have a refactor like the following
 *
 * ```typescript
 *  function fn() {
 *      return err("error happened")
 *  }
 *
 *  function someFunc() {
 *      let data = fn()
 *      if (isErr(data)) {
 *          return err(`someFunc: ${data.error}`)
 *      }
 *  }
 * ```
 *
 * However, the problem with this is that we might refactor `fn()` to return an error object instead:
 *
 * ```typescript
 *  function fn() {
 *      return failure({ error: 'http auth error', code: 401, endpoint: '/auth'  })
 *  }
 * ```
 *
 * Typescript won't complain about implicitly converting `data.error` into the infamous `[object Object]`
 *
 * ```typescript
 *  function someFunc() {
 *      let data = fn()
 *      if (isErr(data)) {
 *          // error will be string "someFunc: [object Object]", which we don't want
 *          return err(`someFunc: ${data.error}`)
 *      }
 *  }
 * ```
 *
 * In order to prevent this, wrap will ensure that the passed error is a string.
 */
export function wrap(context: string, err: Err<string>): Err<string> {
    return { isErr: true, error: `${context}: ${err.error}` }
}

// /**
//  * Returns an explicit error. The function overloads allows the producer to
//  * return string literal types, so that pattern matching errors is very simple
//  */
// export function failure<T extends string>(val: T): Err<T>
// export function failure<T extends object>(val: T): Err<T>
// export function failure<T>(val: T): Err<T> {
//     return { isErr: true, error: val }
// }

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
        if (error?.message) return { isErr: true, error: error.message }

        return { isErr: true, error: String(error) }
    }
}

/**
 * Unwraps a Result. Use this to throw an error, or for compatibility with other
 * libraries / frameworks that expect thrown exceptions.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (result.isErr) {
        if (typeof result.error === 'string') {
            throw new Error(result.error)
        }
        throw result.error
    }

    return result.val
}
