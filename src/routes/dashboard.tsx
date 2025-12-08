import { UserMenu } from '@/components/user-menu'
import * as fns from '@/server/functions'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
    component: RouteComponent,
    async loader() {
        let user = await fns.getUser()
        if (!user?.user) {
            throw redirect({ to: '/' })
        }

        return user
    },
})

function RouteComponent() {
    const user = Route.useLoaderData()

    return (
        <div className="relative min-h-screen flex items-center justify-center">
            <div className="absolute top-6 right-6">
                <UserMenu />
            </div>
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">Welcome back, {user.user.name}!</h1>
                <p className="text-gray-600 mb-4">Navigate to a repository to get started</p>
                <p className="text-sm text-gray-500">e.g., /owner/repo/pulls</p>
            </div>
        </div>
    )
}
