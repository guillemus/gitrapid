import { useNavigate } from 'react-router'
import { type PropsWithChildren } from 'react'
import { useGithubFilePath as useGithubFileParams } from '@/client/utils'
import { CodeSearchBar } from './code-search-bar'
import { SignedIn, SignedOut, SignInButton, SignOutButton } from '@clerk/clerk-react'

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

export function BreadcrumbsWithGitHubLink() {
    const params = useGithubFileParams()

    const pathSegments = params.path ? params.path.split('/').filter(Boolean) : []
    const githubUrl = `https://github.com/${params.owner}/${params.repo}/blob/${params.ref}/${params.path}`

    return (
        <div className="flex items-center justify-between border-b bg-gray-50 p-4">
            <div className="breadcrumbs text-sm">
                <ul>
                    <li>
                        <FastNavlink to={`/${params.owner}/${params.repo}`} className="link">
                            {params.owner}/{params.repo}
                        </FastNavlink>
                    </li>
                    {pathSegments.map((segment, index) => {
                        const segmentPath = pathSegments.slice(0, index + 1).join('/')
                        const isLast = index === pathSegments.length - 1

                        return (
                            <li key={segmentPath}>
                                {isLast ? (
                                    <span className="font-semibold">{segment}</span>
                                ) : (
                                    <FastNavlink
                                        to={`/${params.owner}/${params.repo}/tree/${params.ref}/${segmentPath}`}
                                        className="link"
                                    >
                                        {segment}
                                    </FastNavlink>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </div>

            <div className="flex items-center gap-4">
                <CodeSearchBar owner={params.owner} repo={params.repo} />

                <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                >
                    View on GitHub
                </a>

                <div className="btn">
                    <SignedIn>
                        <SignOutButton></SignOutButton>
                    </SignedIn>
                    <SignedOut>
                        <SignInButton></SignInButton>
                    </SignedOut>
                </div>
            </div>
        </div>
    )
}
