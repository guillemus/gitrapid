import type { LinkComponent } from '@tanstack/react-router'
import { createLink, useRouter } from '@tanstack/react-router'
import * as React from 'react'

const PrefetchLinkComponent = React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => {
    const router = useRouter()

    function onMouseDown(e: React.MouseEvent<HTMLAnchorElement>) {
        const href = props.href
        if (href) {
            void router.preloadRoute({ to: href })
        }
        props.onMouseDown?.(e)
    }

    return <a ref={ref} {...props} onMouseDown={onMouseDown} />
})

const CreatedLink = createLink(PrefetchLinkComponent)

export const PrefetchLink: LinkComponent<typeof PrefetchLinkComponent> = (props) => {
    return <CreatedLink preload={false} {...props} />
}
