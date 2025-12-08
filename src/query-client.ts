import * as fns from '@/server/functions'
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
                    if (error?.message === fns.ERR_UNAUTHORIZED) return false
                    if (error?.message === fns.ERR_NO_SUBSCRIPTION_FOUND) return false

                    return failureCount < 3
                },
            },
        },
        queryCache: new QueryCache({
            onError: (error) => {
                if (error?.message === fns.ERR_NO_SUBSCRIPTION_FOUND) {
                    toast.error('Subscription required')
                    window.location.href = '/pricing'
                    return
                }

                if (error?.message === fns.ERR_UNAUTHORIZED) {
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

const qcPersistent = createPersistedQueryClient('gitpr')

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

type PRData = fns.PRList[number] & fns.PR

export namespace qcopts {
    export type ListPRsData = Awaited<ReturnType<typeof fns.listPRs>>
    export type ListOwnerReposData = Awaited<ReturnType<typeof fns.listOwnerRepos>>

    export const listMyRepos = () =>
        queryOptions({
            queryKey: ['my-repos'],
            queryFn: () => fns.listMyRepos(),
        })

    export const listOwnerRepos = (owner: string, page: number) =>
        queryOptions({
            queryKey: ['repos', owner, page],
            queryFn: () => fns.listOwnerRepos({ data: { owner, page } }),
        })

    export const listPRs = (owner: string, repo: string, page: number, state: 'open' | 'closed') =>
        queryOptions({
            queryKey: ['prs', owner, repo, page, state],
            queryFn: () => fns.listPRs({ data: { owner, repo, page, state } }),
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

            // When fetching the single PR page, we might already have seen data
            // from the previous list.
            // This means that we can reuse that data.

            placeholderData: () => {
                const cache = qc.getQueryCache()
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

    export const getRepositoryStats = (owner: string, repo: string) =>
        queryOptions({
            queryKey: ['repository-stats', owner, repo],
            queryFn: () => fns.getRepositoryStats({ data: { owner, repo } }),
        })

    export type GetUserData = Awaited<ReturnType<typeof fns.getUser>>

    export const getUserOpts = queryOptions({
        queryKey: ['user'],
        queryFn: () => fns.getUser(),
    })

    export const useUser = () => useQuery(getUserOpts, qcMem)
}
