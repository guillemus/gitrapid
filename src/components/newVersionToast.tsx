import { useTanstackQuery } from '@/lib/utils'
import { api } from '@convex/_generated/api'
import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

export function NewVersionToast() {
    let user = useTanstackQuery(api.public.shared.getUser, {})
    let newVersionSeen = useMutation(api.public.shared.newVersionSeen)
    let toastIdRef = useRef<string | number | undefined>(undefined)
    let channelRef = useRef<BroadcastChannel | undefined>(undefined)

    useEffect(() => {
        // Set up BroadcastChannel once
        if (!channelRef.current) {
            let channel = new BroadcastChannel('app-reload')

            function handleReload(event: MessageEvent) {
                console.log('Received reload message from another tab', event.data)
                if (event.data?.type === 'reload') {
                    window.location.reload()
                }
            }

            channel.addEventListener('message', handleReload)
            channelRef.current = channel
            console.log('BroadcastChannel set up for app-reload')
        }

        if (user?.newVersion && toastIdRef.current === undefined) {
            let toastId = toast.warning('New version available!', {
                closeButton: false,
                description: 'Reload to update.',
                duration: Infinity,
                action: {
                    label: 'Reload',
                    onClick: async () => {
                        await newVersionSeen()

                        // Broadcast to other tabs
                        if (channelRef.current) {
                            channelRef.current.postMessage({ type: 'reload' })
                            console.log('Broadcasted reload message to other tabs')
                        }

                        await new Promise((resolve) => setTimeout(resolve, 200))
                        window.location.reload()
                    },
                },
            })
            toastIdRef.current = toastId
        } else if (user?.newVersion === false && toastIdRef.current !== undefined) {
            toast.dismiss(toastIdRef.current)
            toastIdRef.current = undefined
        }
    }, [user?.newVersion, newVersionSeen])

    // Cleanup channel on unmount
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                channelRef.current.close()
                channelRef.current = undefined
            }
        }
    }, [])

    return null
}
