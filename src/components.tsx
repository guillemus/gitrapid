import { useNavigate } from 'react-router'
import { type PropsWithChildren } from 'react'

type FastNavlinkProps = PropsWithChildren<{
    to: string
    className: string
}>

export function FastNavlink(props: FastNavlinkProps) {
    const navigate = useNavigate()

    function handleMouseDown(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault()
        e.stopPropagation()
        navigate(props.to)
    }

    function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault()
    }

    return (
        <a href={props.to} onMouseDown={handleMouseDown} onClick={handleClick} {...props}>
            {props.children}
        </a>
    )
}
