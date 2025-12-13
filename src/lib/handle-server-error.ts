// All generic error handling should be handled here.
// This file centralizes client-side error handling for tRPC/query errors.
// Error codes are defined in @/server/shared.ts

import {
    ERR_NO_SUBSCRIPTION_FOUND,
    ERR_RATE_LIMITED,
    ERR_REPO_ACCESS_DENIED,
    ERR_UNAUTHORIZED,
} from '@/server/shared'
import { toast } from 'sonner'

// Handles query errors globally. Called from QueryCache onError.
export function handleServerError(error: Error): void {
    if (error.message === ERR_NO_SUBSCRIPTION_FOUND) {
        toast.error('Subscription required')
        window.location.href = '/pricing'
        return
    }

    if (error.message === ERR_UNAUTHORIZED) {
        toast.error('Please log in to continue')
        window.location.href = '/'
        return
    }

    if (error.message === ERR_RATE_LIMITED) {
        toast.error('Too many requests. Please wait a moment.')
        return
    }

    if (error.message === ERR_REPO_ACCESS_DENIED) {
        toast.error('This repository requires a subscription to access.')
        return
    }
}
