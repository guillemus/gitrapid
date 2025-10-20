import type { QueryClient } from '@tanstack/react-query'
import { persistQueryClient as tanstackPersistQueryClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

// Caches to indexed db. I might want to do this for max (perceived) performance.
export async function persistQueryClient(queryClient: QueryClient, dbname: string) {
    const persister = {
        persistClient: async (client: unknown) => {
            await set(dbname, client)
        },
        restoreClient: async () => {
            return await get(dbname)
        },
        removeClient: async () => {
            await del(dbname)
        },
    }

    // fixme: automate this, manually changing this is horrible
    let buster = `${dbname}-v0.0.1`

    let [, p] = tanstackPersistQueryClient({ queryClient, persister, buster })
    await p
}
