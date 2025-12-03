import { ClientOnly } from '@/components/client-only'
import { PRDetail } from '@/components/pr-detail'

export default function PRPage() {
    return (
        <div className="min-h-screen p-8 font-sans">
            <ClientOnly>
                <PRDetail />
            </ClientOnly>
        </div>
    )
}
