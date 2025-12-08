import { HeaderRepo } from '@/components/header'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo')({
    component: RepoLayout,
})

function RepoLayout() {
    let params = Route.useParams()
    return (
        <div className="min-h-screen flex flex-col font-sans">
            <HeaderRepo owner={params.owner} repo={params.repo} />

            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    )
}
