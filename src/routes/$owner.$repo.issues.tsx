import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/issues')({
    component: IssuesPage,
})

function IssuesPage() {
    return <ComingSoon />
}
