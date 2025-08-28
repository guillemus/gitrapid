import { Link, useNavigate } from 'react-router'

export function FastLink(props: {
    to: string
    className?: string
    children: React.ReactNode
    onMouseOver?: () => void
}) {
    let navigate = useNavigate()

    return (
        <Link
            to={props.to}
            onMouseOver={props.onMouseOver}
            onMouseDown={() => navigate(props.to)}
            className={props.className}
        >
            {props.children}
        </Link>
    )
}
