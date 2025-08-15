import { type Result, type ResultAsync } from './utils'

export {}

declare global {
    export type R<T = null> = ResultAsync<T>
}
