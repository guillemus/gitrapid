'use client'

import { QueryClient } from '@tanstack/react-query'
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
