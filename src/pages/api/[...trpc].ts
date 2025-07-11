import type { APIRoute } from 'astro'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter, type Context } from '@/server/trpc'

export const ALL: APIRoute = async (ctx) => {
    let headers: Record<string, string> = {}
    function setHeader(key: string, val: string) {
        headers[key] = val
    }

    let res = await fetchRequestHandler({
        endpoint: '/api',
        req: ctx.request,
        router: appRouter,
        createContext: (): Context => ({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
            setHeader,
        }),
    })

    for (let [key, val] of Object.entries(headers)) {
        res.headers.set(key, val)
    }

    return res
}
