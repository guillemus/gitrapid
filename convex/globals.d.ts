import type { Result } from './utils'

declare global {
    /**
     * Result type for actions and mutations. This is a convenience type to shorten
     * as much as possible return types
     */
    export type R<T = null> = Promise<Result<T>>
}

export {}
