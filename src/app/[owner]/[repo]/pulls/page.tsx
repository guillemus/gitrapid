import { ClientOnly } from '@/components/client-only'
import { PRList } from '@/components/pr-list'

export default function RepoPage() {
    return (
        <div className="min-h-screen p-8 font-sans">
            <ClientOnly>
                <PRList />
            </ClientOnly>
        </div>
    )
}
