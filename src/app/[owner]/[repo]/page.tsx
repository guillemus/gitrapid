import { ClientOnly, PRList } from '@/app/client'

export default function RepoPage() {
    return (
        <ClientOnly>
            <PRList />
        </ClientOnly>
    )
}
