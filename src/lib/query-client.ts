import type { PR, PRList } from '@/server/router'
import * as server from '@/server/server'
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
import { toast } from 'sonner'

// newQueryClient creates the default query client. Useful to set custom
// behaviour for all queries
function newQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 10 * 1000,
                retry: (failureCount, error) => {
                    if (error?.message === server.ERR_UNAUTHORIZED) return false
                    if (error?.message === server.ERR_NO_SUBSCRIPTION_FOUND) return false

                    return failureCount < 3
                },
            },
        },
        queryCache: new QueryCache({
            onError: (error) => {
                if (error?.message === server.ERR_NO_SUBSCRIPTION_FOUND) {
                    toast.error('Subscription required')
                    window.location.href = '/pricing'
                    return
                }

                if (error?.message === server.ERR_UNAUTHORIZED) {
                    const callbackURL = window.location.pathname + window.location.search
                    sessionStorage.setItem('auth_callback', callbackURL)

                    toast.error('Please log in to continue')

                    window.location.href = '/'
                }
            },
        }),
    })
}

export const qcMem = newQueryClient()
export const qcPersistent = createPersistedQueryClient('gitpr')

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
            return await kv.get(dbname)
        },
        removeClient: async () => {
            await kv.del(dbname)
        },
    }

    let buster = `${dbname}-0001`

    persistQueryClient({ queryClient: qc, persister, buster })

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

        placeholderData: () => {
            const cache = queryClient.getQueryCache()
            const allQueries = cache.findAll({ queryKey: ['prs', owner, repo] })

            for (const query of allQueries) {
                const cached = query.state.data as PRData[]
                if (cached) {
                    const found = cached.find((pr) => pr.number === number)
                    if (found) {
                        // this is horrible, don't get me wrong. At some point the rpc functions
                        // should return actually a proper typescript type that
                        // maps the octokit type to what we can easily use in the app.

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return found as any
                    }
                }
            }
            return undefined
        },
    })
}

export const getPRFiles = (owner: string, repo: string, number: number) =>
    trpc.getPRFiles.queryOptions({ owner, repo, number })

export const getPRComments = (owner: string, repo: string, number: number, page: number) =>
    trpc.getPRComments.queryOptions({ owner, repo, number, page })

export const getRepositoryStats = (owner: string, repo: string) =>
    trpc.getRepositoryStats.queryOptions({ owner, repo })

export const getUserOpts = trpc.getUser.queryOptions()

export const useUser = () => useQuery(getUserOpts, qcMem)

const getRepositoryMetadata = (owner: string, repo: string) =>
    trpc.getRepositoryMetadata.queryOptions({ owner, repo })

const getFileContents = (params: { owner: string; repo: string; path?: string; ref?: string }) =>
    trpc.getFileContents.queryOptions(params)

const getRepositoryTree = (owner: string, repo: string, branch?: string) =>
    trpc.getRepositoryTree.queryOptions({ owner, repo, branch })

export const fileTree = (params: { owner: string; repo: string; ref?: string }) =>
    queryOptions({
        queryKey: ['filetree', params.owner, params.repo, params.ref],
        queryFn: async (ctx) => {
            let meta = await ctx.client.fetchQuery(getRepositoryMetadata(params.owner, params.repo))

            let ref = params.ref ?? meta.defaultBranch
            let query = await ctx.client.fetchQuery(
                getRepositoryTree(params.owner, params.repo, ref),
            )
            return query
        },
    })

export const file = (params: { owner: string; repo: string; ref?: string; path?: string }) =>
    queryOptions({
        queryKey: ['file', params.owner, params.repo, params.ref, params.path],
        queryFn: async (ctx) => {
            let meta = await ctx.client.fetchQuery(getRepositoryMetadata(params.owner, params.repo))

            let ref = params.ref ?? meta.defaultBranch
            let query = await ctx.client.fetchQuery(
                getFileContents({
                    owner: params.owner,
                    repo: params.repo,
                    ref,
                    path: params.path,
                }),
            )
            return query
        },
    })
