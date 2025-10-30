import { Toaster } from '@/components/ui/sonner'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { NewVersionToast } from '@/components/newVersionToast'

function RootOutlet() {
    return (
        <>
            <Toaster richColors theme="light" closeButton />
            <NewVersionToast />
            <Outlet />
        </>
    )
}

export const Route = createRootRoute({ component: RootOutlet })
