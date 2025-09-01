import { QueryClient } from '@tanstack/react-query'
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

    let [, p] = tanstackPersistQueryClient({ queryClient, persister })
    await p
}
