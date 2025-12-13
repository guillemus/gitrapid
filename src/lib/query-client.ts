import { handleServerError } from '@/lib/handle-server-error'
import type { PR, PRList } from '@/server/router'
import { isNonRetryableError } from '@/server/shared'
import { trpc, trpcClient } from '@/server/trpc-client'
import {
    QueryCache,
    QueryClient,
    queryOptions,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import * as kv from 'idb-keyval'

// newQueryClient creates the default query client. Useful to set custom
// behaviour for all queries
function newQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 10 * 1000,
                retry: (failureCount, error) => {
                    if (isNonRetryableError(error)) return false
                    return failureCount < 3
                },
            },
        },
        queryCache: new QueryCache({
            onError: handleServerError,
        }),
    })
}

export const qcMem = newQueryClient()
export const qcPersistent = createPersistedQueryClient('GitRapid')

// export const qcDefault = qcMem
export const qcDefault = qcPersistent

function createPersistedQueryClient(dbname: string) {
    let qc = newQueryClient()
    if (import.meta.env.SSR) {
        return qc
    }

    const persister = {
        persistClient: async (client: unknown) => {
            await kv.set(dbname, client)
        },
        restoreClient: async () => {
            // eslint-disable-next-line
            return await kv.get(dbname)
        },
        removeClient: async () => {
            await kv.del(dbname)
        },
    }

    let buster = `${dbname}-0001`

    void persistQueryClient({ queryClient: qc, persister, buster })

    return qc
}

type PRData = PRList[number] & PR

// For components - with placeholderData from listPRs cache
export const useGetPROpts = (owner: string, repo: string, number: number) => {
    let queryClient = useQueryClient()

    return queryOptions({
        queryKey: ['pr', owner, repo, number],
        queryFn: () => trpcClient.getPR.query({ owner, repo, number }),

        // When fetching the single PR page, we might already have seen data
        // from the previous list.
        // This means that we can reuse that data.

        placeholderData: (): PR | undefined => {
            // Check both open and closed PR lists, pages 1-3
            const states = ['open', 'closed'] as const
            for (const state of states) {
                for (let page = 1; page <= 3; page++) {
                    const { queryKey } = trpc.listPRs.queryOptions({ owner, repo, page, state })
                    const cached = queryClient.getQueryData(queryKey)
                    if (cached) {
                        const found = cached.find((pr) => pr.number === number)
                        if (found) {
                            // PRList doesn't have changedFiles, provide placeholder value
                            return { ...found, changedFiles: 0 }
                        }
                    }
                }
            }
            return undefined
        },
    })
}

export const getUserOpts = trpc.getUser.queryOptions()

export const useUser = () => useQuery(getUserOpts, qcMem)

export const fileTree = (params: { owner: string; repo: string; ref?: string }) =>
    queryOptions({
        queryKey: ['filetree', params.owner, params.repo, params.ref],
        queryFn: async (ctx) => {
            let meta = await ctx.client.fetchQuery(trpc.getRepositoryMetadata.queryOptions(params))
            let ref = params.ref ?? meta.defaultBranch

            let query = await ctx.client.fetchQuery(
                trpc.getRepositoryTree.queryOptions({
                    ...params,
                    ref,
                }),
            )
            return query
        },
    })

export const file = (params: { owner: string; repo: string; ref?: string; path?: string }) =>
    queryOptions({
        queryKey: ['file', params.owner, params.repo, params.ref, params.path],
        queryFn: async (ctx) => {
            let meta = await ctx.client.fetchQuery(trpc.getRepositoryMetadata.queryOptions(params))

            let ref = params.ref ?? meta.defaultBranch
            let query = await ctx.client.fetchQuery(
                trpc.getFileContents.queryOptions({
                    owner: params.owner,
                    repo: params.repo,
                    ref,
                    path: params.path,
                }),
            )
            return query
        },
    })
