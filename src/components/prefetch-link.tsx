import Link from 'next/link'

export function PrefetchLink(props: {
    href: string
    className?: string
    onPrefetch?: () => void
    children: React.ReactNode
}) {
    function onMouseEnter() {
        if (props.onPrefetch) {
            props.onPrefetch()
        }
    }

    return (
        <Link href={props.href} onMouseEnter={onMouseEnter} className={props.className}>
            {props.children}
        </Link>
    )
}
