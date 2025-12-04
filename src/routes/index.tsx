import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    beforeLoad: () => {
        throw redirect({ to: '/$owner/$repo/pulls', params: { owner: 'sst', repo: 'sst' } })
    },
})
