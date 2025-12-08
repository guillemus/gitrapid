import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/')({
    component: CodePage,
})

function CodePage() {
    return <ComingSoon />
}
