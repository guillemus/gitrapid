import { useMutable } from '@/client/utils'
import { SignInButton } from '@clerk/clerk-react'

export function Login() {
    const state = useMutable({ isLoading: false })

    return (
        <div className="flex min-h-screen items-center justify-center bg-white p-4">
            <div className="card w-full max-w-md border border-slate-200 bg-white shadow-lg">
                <div className="card-body">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-gray-800">GitHub Explorer</h1>
                        <p className="text-gray-600">Browse repositories</p>
                    </div>

                    <div className="flex justify-center">
                        <div
                            onClick={() => (state.isLoading = true)}
                            className="btn btn-primary w-50"
                        >
                            {state.isLoading ? (
                                <span className="loading"></span>
                            ) : (
                                <SignInButton>Login with GitHub</SignInButton>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
