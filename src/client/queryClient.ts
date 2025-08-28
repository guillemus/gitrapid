import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

// caches queries to indexeddb
export const idbQueryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
        },
    },
})

const idbPersister = {
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

void persistQueryClient({
    queryClient: idbQueryClient,
    persister: idbPersister,
})
