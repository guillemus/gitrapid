import { Toaster } from '@/components/ui/sonner'
import { Outlet, createRootRoute } from '@tanstack/react-router'

function RootOutlet() {
    return (
        <>
            <Toaster richColors theme="light" closeButton />
            <Outlet />
        </>
    )
}

export const Route = createRootRoute({ component: RootOutlet })
