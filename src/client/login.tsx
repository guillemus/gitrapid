import { authClient, useMutable } from '@/client/utils'
import type { PropsWithChildren } from 'react'
import { useLocation } from 'react-router'

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
    // Using the pathname as the callback url ensures that the user will be
    // redirected to the same page after logging in, which makes a much better user
    // experience.
    const pathname = useLocation().pathname
    const state = useMutable({ isLoading: false })

    return (
        <button
            onClick={() => {
                state.isLoading = true
                // So, just in case. This should not happen, but better auth can
                // sometimes timeout and crash, which is quite annoying, but well
                // what can you do.
                setTimeout(() => {
                    state.isLoading = false
                }, 5000)

                authClient.signIn.social({
                    provider: 'github',
                    callbackURL: pathname,
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
                </div>
            </div>
        </div>
    )
}
