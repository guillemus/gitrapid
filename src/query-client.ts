import * as fns from '@/server/functions'
import { QueryClient, queryOptions, useQueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import * as kv from 'idb-keyval'

// newQueryClient creates the default query client. Useful to set custom
// behaviour for all queries
function newQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 10 * 1000,
            },
        },
    })
}

export const qcPersistent = await createPersistedQueryClient('gitpr')
export const qcMem = newQueryClient()

// export const qcDefault = qcMem
export const qcDefault = qcPersistent

async function createPersistedQueryClient(dbname: string) {
    let qc = newQueryClient()
    if (typeof window === 'undefined') {
        return qc
    }

    const persister = {
        persistClient: async (client: unknown) => {
            await kv.set(dbname, client)
        },
        restoreClient: async () => {
            return await kv.get(dbname)
        },
        removeClient: async () => {
            await kv.del(dbname)
        },
    }

    let buster = `${dbname}-0001`

    let [, p] = persistQueryClient({ queryClient: qc, persister, buster })
    await p

    return qc
}

// Types split into PRCore and PRData because listPRs returns most of the data
// needed to display a single PR. This lets useGetPROpts use listPRs cache as
// placeholderData, so that the page transition feels instant.
export type PRCore = {
    number: number
    title: string
    state: string
    body: string | null
    user: { login: string } | null
    base: { ref: string; repo: { owner: { login: string } } }
    head: { ref: string; repo: { owner: { login: string } } | null }
}

// Full PR data includes optional getPR-only fields
export type PRData = PRCore & {
    changed_files?: number
    additions?: number
    deletions?: number
}

export namespace qcopts {
    export type ListPRsData = Awaited<ReturnType<typeof fns.listPRs>>
    export const listPRs = (owner: string, repo: string, page?: number) =>
        queryOptions({
            queryKey: ['prs', owner, repo, page],
            queryFn: () => fns.listPRs({ data: { owner, repo, page } }),
        })

    // For loaders - no placeholderData (can't use hooks outside React)
    export const getPR = (owner: string, repo: string, number: number) =>
        queryOptions({
            queryKey: ['pr', owner, repo, number],
            queryFn: () => fns.getPR({ data: { owner, repo, number } }),
        })

    // For components - with placeholderData from listPRs cache
    export const useGetPROpts = (owner: string, repo: string, number: number) => {
        let qc = useQueryClient()

        return queryOptions({
            queryKey: ['pr', owner, repo, number],
            queryFn: () => fns.getPR({ data: { owner, repo, number } }),
            placeholderData: () => {
                let page = 1
                while (true) {
                    let cached = qc.getQueryData<PRCore[]>(['prs', owner, repo, page])
                    if (!cached) break
                    let found = cached.find((pr) => pr.number === number)
                    if (found) return found as any
                    page++
                }
                return undefined
            },
        })
    }

    export const getPRFiles = (owner: string, repo: string, number: number) =>
        queryOptions({
            queryKey: ['pr-files', owner, repo, number],
            queryFn: () => fns.getPRFiles({ data: { owner, repo, number } }),
        })

    export const getPRComments = (owner: string, repo: string, number: number, page: number) =>
        queryOptions({
            queryKey: ['pr-comments', owner, repo, number, page],
            queryFn: () => fns.getPRComments({ data: { owner, repo, number, page } }),
        })

    export const getPRReviewComments = (
        owner: string,
        repo: string,
        number: number,
        page: number,
    ) =>
        queryOptions({
            queryKey: ['pr-review-comments', owner, repo, number, page],
            queryFn: () => fns.getPRReviewComments({ data: { owner, repo, number, page } }),
        })
}
