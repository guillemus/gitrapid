import { useRouterState } from '@tanstack/react-router'
import { Suspense } from 'react'

export function GithubLink() {
    return (
        <Suspense>
            <Inner></Inner>
        </Suspense>
    )

    function Inner() {
        let routerState = useRouterState()
        let path = routerState.location.pathname
        return (
            <div className="absolute top-0 right-0">
                <a href={`https://github.com${path}`} target="_blank">
                    go to github
                </a>
            </div>
        )
    }
}
