import Link from 'next/link'

export function PrefetchLink(props: {
    href: string
    className?: string
    onPrefetch: () => void
    children: React.ReactNode
}) {
    function onMouseDown() {
        props.onPrefetch()
    }

    return (
        <Link href={props.href} onMouseDown={onMouseDown} className={props.className}>
            {props.children}
        </Link>
    )
}
