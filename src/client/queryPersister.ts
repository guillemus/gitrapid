import type { QueryClient } from '@tanstack/react-query'
import { persistQueryClient as tanstackPersistQueryClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

// Caches to indexed db. I might want to do this for max (perceived) performance.
export async function persistQueryClient(queryClient: QueryClient) {
    const persister = {
        persistClient: async (client: unknown) => {
            await set('react-query-cache', client)
        },
        restoreClient: async () => {
            return await get('react-query-cache')
        },
        removeClient: async () => {
            await del('react-query-cache')
        },
    }

    // fixme: automate this, manually changing this is horrible
    let buster = 'v0.0.1'

    let [, p] = tanstackPersistQueryClient({ queryClient, persister, buster })
    await p
}
