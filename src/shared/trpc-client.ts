import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@/server/trpc'
import type { inferProcedureOutput } from '@trpc/server'

export type GetGithubFileOutput = inferProcedureOutput<AppRouter['getGithubFile']>

export const client = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: '/api' })],
})
