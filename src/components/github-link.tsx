'use client'

import { usePathname } from 'next/navigation'
import { Suspense } from 'react'

export function GithubLink() {
    return (
        <Suspense>
            <Inner></Inner>
        </Suspense>
    )

    function Inner() {
        let path = usePathname()
        console.log(path)
        return (
            <div className="absolute top-0 right-0">
                <a href={`https://github.com${path}`} target="_blank">
                    go to github
                </a>
            </div>
        )
    }
}
