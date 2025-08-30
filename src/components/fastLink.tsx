import { Link, useNavigate } from 'react-router'

export function FastLink(props: {
    to: string
    className?: string
    children: React.ReactNode
    onMouseOver?: () => void
}) {
    let navigate = useNavigate()

    // If the link contains 'https', treat it as an external link
    if (props.to.includes('https')) {
        return (
            <a
                href={props.to}
                onMouseOver={props.onMouseOver}
                className={props.className}
                target="_blank"
                rel="noopener noreferrer"
            >
                {props.children}
            </a>
        )
    }

    // Otherwise, treat it as an internal route
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
