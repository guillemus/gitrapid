import { authClient, useMutable } from '@/client/utils'
import type { PropsWithChildren, ReactNode } from 'react'
import { useSearchParams } from 'react-router'

export function SignedIn(props: PropsWithChildren) {
    const { data } = authClient.useSession()

    if (!!data) return props.children
    return null
}

export function SignedOut(props: PropsWithChildren) {
    const sess = authClient.useSession()

    if (!!sess.data || sess.isPending) return null
    return props.children
}

export function SignInButton() {
    const state = useMutable({ isLoading: false })

    return (
        <button
            onClick={() => {
                state.isLoading = true
                authClient.signIn.social({
                    provider: 'github',
                    callbackURL: '/',
                })
            }}
            className="btn btn-primary w-50 cursor-pointer"
        >
            {state.isLoading && <span className="loading"></span>}
            {!state.isLoading && 'Login with GitHub'}
        </button>
    )
}

export function SignOutButton() {
    return (
        <button
            className="btn btn-primary w-50 cursor-pointer"
            onClick={() => authClient.signOut()}
        >
            Sign Out
        </button>
    )
}

export function Login() {
    const [params] = useSearchParams()

    const wasRateLimited = params.get('rateLimited') !== null

    return (
        <div className="flex min-h-screen items-center justify-center bg-white p-4">
            <div className="card w-full max-w-md border border-slate-200 bg-white shadow-lg">
                <div className="card-body">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-gray-800">GitHub Explorer</h1>
                        <p className="text-gray-600">Browse repositories</p>
                    </div>

                    <div className="flex justify-center">
                        <SignInButton></SignInButton>
                    </div>

                    {wasRateLimited && (
                        <div className="alert alert-warning mt-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6 shrink-0 stroke-current"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                                />
                            </svg>
                            <span>
                                You were rate-limited by GitHub. Please log in to continue browsing
                                repositories.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
