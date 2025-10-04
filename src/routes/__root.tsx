import { Outlet, createRootRoute } from '@tanstack/react-router'

function RootOutlet() {
    return <Outlet />
}

export const Route = createRootRoute({ component: RootOutlet })
