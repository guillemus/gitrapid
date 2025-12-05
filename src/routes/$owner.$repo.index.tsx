import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$owner/$repo/')({
    loader({ params }) {
        throw redirect({ to: '/$owner/$repo/pulls', params })
    },
})
