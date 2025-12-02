import { ClientOnly, PRDetail } from '@/app/client'

export default function PRPage() {
    return (
        <div className="min-h-screen p-8 font-sans">
            <ClientOnly>
                <PRDetail />
            </ClientOnly>
        </div>
    )
}
