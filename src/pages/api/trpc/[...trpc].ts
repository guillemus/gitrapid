import { appRouter } from '@/server/router'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { APIRoute } from 'astro'

const handler: APIRoute = ({ request }) => {
    return fetchRequestHandler({
        endpoint: '/api/trpc',
        req: request,
        router: appRouter,
        createContext: () => ({ req: request }),
    })
}

export const GET = handler
export const POST = handler
