import { LoginButton } from '@/components/login-button'

export function Landing() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full text-center p-8">
                <h1 className="text-4xl font-bold mb-2">gitpr.fast</h1>
                <p className="text-gray-600 mb-8">A fast open source GitHub UI</p>

                <LoginButton />

                <p className="text-sm text-gray-500 mt-4">
                    Access your GitHub pull requests with a fast, modern interface
                </p>
            </div>
        </div>
    )
}
