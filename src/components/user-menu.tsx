import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { qc } from '@/lib'
import { authClient } from '@/lib/auth-client'
import { useNavigate } from '@tanstack/react-router'

export function UserMenu() {
    const navigate = useNavigate()
    const user = qc.useUser()

    if (!user.data) return <Skeleton className="w-8 h-8 rounded-full" />

    const hasActiveSubscription =
        user.data.subscription?.status === 'active' || user.data.subscription?.status === 'trialing'

    return (
        <div className="relative group">
            <img
                src={user.data.session.user.image || ''}
                alt={user.data.session.user.name || ''}
                className="w-8 h-8 rounded-full cursor-pointer"
            />
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="px-4 py-2 border-b">
                    <p className="text-sm font-medium">{user.data.session.user.name || ''}</p>
                    <p className="text-xs text-gray-500">{user.data.session.user.email || ''}</p>
                </div>
                {hasActiveSubscription && (
                    <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => authClient.customer.portal()}
                    >
                        Manage Subscription
                    </Button>
                )}
                <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={async () => {
                        await authClient.signOut()
                        localStorage.removeItem('hasLoggedIn')
                        await navigate({ to: '/' })
                    }}
                >
                    Logout
                </Button>
            </div>
        </div>
    )
}
