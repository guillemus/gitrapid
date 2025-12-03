import { useEffect, useState } from 'react'

export function ClientOnly(props: React.PropsWithChildren) {
    let [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    if (!isClient) {
        return null
    }

    return props.children
}
