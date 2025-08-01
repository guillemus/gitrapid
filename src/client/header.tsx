import { Button } from '@/components/ui/button'
import { useAuthActions } from '@convex-dev/auth/react'
import { Authenticated, Unauthenticated } from 'convex/react'
import { useLogout } from './convex'
import { FastLink } from '@/components/ui/link'

export function Header(props: { owner?: string; repo?: string }) {
    const authActions = useAuthActions()
    const logout = useLogout()

    return (
        <header className={'w-full border-b bg-white dark:bg-gray-950'}>
            <div className="flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tracking-tight">gitrapid</span>

                    {props.owner && props.repo && (
                        <span className="flex items-center gap-2 text-sm text-gray-500">
                            <FastLink
                                to={`/${props.owner}/${props.repo}`}
                                className="text-blue-600 hover:underline"
                            >
                                <span>
                                    {props.owner}/{props.repo}
                                </span>
                            </FastLink>
                            <FastLink
                                to={`/${props.owner}/${props.repo}/issues`}
                                className="ml-2 text-blue-600 hover:underline"
                            >
                                Issues
                            </FastLink>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Authenticated>
                        <Button variant="outline" size="sm" onClick={logout}>
                            Sign out
                        </Button>
                    </Authenticated>
                    <Unauthenticated>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                authActions.signIn('github', {
                                    redirectTo: '/dash',
                                })
                            }}
                        >
                            Sign in
                        </Button>
                    </Unauthenticated>
                </div>
            </div>
        </header>
    )
}
