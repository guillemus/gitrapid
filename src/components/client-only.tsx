import { useEffect, useState } from 'react'

export function ClientOnly(props: React.PropsWithChildren) {
    let [isClient, setIsClient] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsClient(true)
    }, [])

    if (!isClient) {
        return null
    }

    return props.children
}
