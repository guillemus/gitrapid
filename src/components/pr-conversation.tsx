'use client'

import { qcopts } from '@/query-client'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'

export function PRConversation() {
    let params = useParams<{
        owner: string
        repo: string
        number: string
    }>()

    let pr = useQuery(qcopts.getPR(params.owner, params.repo, Number(params.number)))

    return (
        <>
            {pr.data?.body && (
                <div className="border rounded p-4 whitespace-pre-wrap">{pr.data.body}</div>
            )}
            {!pr.data?.body && <div className="text-zinc-500 italic">No description provided.</div>}
        </>
    )
}
