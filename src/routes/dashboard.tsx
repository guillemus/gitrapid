import { Skeleton } from '@/components/ui/skeleton'
import { UserMenu } from '@/components/user-menu'
import { qcopts } from '@/query-client'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
    component: RouteComponent,
})

function RouteComponent() {
    const user = qcopts.useUser()
    let content = null

    if (user.isPending) {
        content = (
            <div className="text-center">
                <Skeleton className="h-10 w-64 mb-4 mx-auto" />
                <Skeleton className="h-6 w-96 mb-4 mx-auto" />
                <Skeleton className="h-5 w-48 mx-auto" />
            </div>
        )
    } else {
        content = (
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">Welcome back, {user.data?.user.name}!</h1>
                <p className="text-gray-600 mb-4">Navigate to a repository to get started</p>
                <p className="text-sm text-gray-500">e.g., /owner/repo/pulls</p>
            </div>
        )
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center">
            <div className="absolute top-6 right-6">
                <UserMenu />
            </div>
            {content}
        </div>
    )
}
