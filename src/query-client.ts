'use client'

import { QueryClient, queryOptions } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import * as kv from 'idb-keyval'
import * as fns from '@/functions'

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

export async function createPersistedQueryClient(dbname: string) {
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

export namespace qcopts {
    export const listPRs = (owner: string, repo: string, page?: number) =>
        queryOptions({
            queryKey: ['prs', owner, repo, page],
            queryFn: () => fns.listPRs(owner, repo, page),
        })

    export const getPR = (owner: string, repo: string, number: number) =>
        queryOptions({
            queryKey: ['pr', owner, repo, number],
            queryFn: () => fns.getPR(owner, repo, number),
        })

    export const getPRFiles = (owner: string, repo: string, number: number) =>
        queryOptions({
            queryKey: ['pr-files', owner, repo, number],
            queryFn: () => fns.getPRFiles(owner, repo, number),
        })
}
