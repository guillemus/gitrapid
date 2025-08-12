import type { Ok, Err } from '@convex/utils'

declare global {
    /** Async Result type */
    type R<T = null, E = string> = Promise<Ok<T> | Err<E>>
}

export {}
