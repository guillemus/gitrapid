// All error codes should be defined here.
// These are used across the app for consistent error handling.
// See lib/error-handling.ts for client-side error handling logic.

export const ERR_UNAUTHORIZED = 'error_unauthorized'
export const ERR_NO_SUBSCRIPTION_FOUND = 'error_no_subscription_found'
export const ERR_RATE_LIMITED = 'error_rate_limited'
export const ERR_REPO_ACCESS_DENIED = 'error_repo_access_denied'

export function isNonRetryableError(error: Error): boolean {
    return (
        error.message === ERR_UNAUTHORIZED ||
        error.message === ERR_NO_SUBSCRIPTION_FOUND ||
        error.message === ERR_RATE_LIMITED ||
        error.message === ERR_REPO_ACCESS_DENIED
    )
}
