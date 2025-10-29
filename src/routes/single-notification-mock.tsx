import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/single-notification-mock')({
    component: RouteComponent,
})

function RouteComponent() {
    return <div>Hello "/single-notification-mock"!</div>
}
