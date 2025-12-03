import { ClientOnly } from '@/components/client-only'
import { PRLayoutClient } from '@/components/pr-layout-client'

export default function PRLayout(props: { children: React.ReactNode }) {
    return (
        <ClientOnly>
            <PRLayoutClient>{props.children}</PRLayoutClient>
        </ClientOnly>
    )
}
