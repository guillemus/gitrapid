import { Link } from '@tanstack/react-router'

export function PrefetchLink(props: {
    to: string
    className?: string
    onPrefetch?: () => void
    children: React.ReactNode
}) {
    function onMouseDown() {
        if (props.onPrefetch) {
            props.onPrefetch()
        }
    }

    return (
        <Link to={props.to} onMouseDown={onMouseDown} className={props.className}>
            {props.children}
        </Link>
    )
}
