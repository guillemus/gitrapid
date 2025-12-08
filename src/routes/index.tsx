import { Landing } from '@/components/landing'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: Landing,
})
