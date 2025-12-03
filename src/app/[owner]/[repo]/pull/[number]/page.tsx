import { ClientOnly } from '@/components/client-only'
import { PRConversation } from '@/components/pr-conversation'

export default function PRPage() {
    return (
        <ClientOnly>
            <PRConversation />
        </ClientOnly>
    )
}
