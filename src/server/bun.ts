import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './router'

const server = Bun.serve({
    port: 3001,
    async fetch(request: Request) {
        const url = new URL(request.url)

        if (url.pathname.startsWith('/api/trpc')) {
            return fetchRequestHandler({
                endpoint: '/api/trpc',
                req: request,
                router: appRouter,
            })
        }

        return new Response('Not found', { status: 404 })
    },
})

console.log(`tRPC server running at http://localhost:${server.port}`)
