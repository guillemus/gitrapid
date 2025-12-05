import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useNavigate } from '@tanstack/react-router'

export function UserMenu() {
    const navigate = useNavigate()
    const { data: session } = authClient.useSession()

    if (!session) return null

    return (
        <div className="fixed top-4 right-4 z-50">
            <div className="relative group">
                <img
                    src={session.user.image || ''}
                    alt={session.user.name || ''}
                    className="w-8 h-8 rounded-full cursor-pointer"
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="px-4 py-2 border-b">
                        <p className="text-sm font-medium">{session.user.name || ''}</p>
                        <p className="text-xs text-gray-500">{session.user.email || ''}</p>
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={async () => {
                            await authClient.signOut()
                            await navigate({ to: '/' })
                        }}
                    >
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    )
}
