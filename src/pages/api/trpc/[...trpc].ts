import { auth } from '@/auth'
import { checkRatelimitAnon, checkRatelimitUser } from '@/server/redis'
import { appRouter } from '@/server/router'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { APIRoute } from 'astro'
import { checkBotId } from 'botid/server'

const handler: APIRoute = async ({ request, clientAddress }) => {
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
    })

    const verification = await checkBotId({
        advancedOptions: {
            headers,
        },
        developmentOptions: { bypass: 'HUMAN', isDevelopment: import.meta.env.DEV },
    })
    if (!verification.isHuman) {
        return new Response('Forbidden', { status: 403 })
    }

    const session = await auth.api.getSession({ headers: request.headers })

    let ratelimitResult
    if (session) {
        ratelimitResult = await checkRatelimitUser(session.user.id)
    } else {
        ratelimitResult = await checkRatelimitAnon(clientAddress)
    }

    if (!ratelimitResult.success) {
        return new Response(
            JSON.stringify({ error: 'RATE_LIMITED', message: 'Too many requests' }),
            {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }

    return fetchRequestHandler({
        endpoint: '/api/trpc',
        req: request,
        router: appRouter,
        createContext: () => ({ req: request, session }),
    })
}

export const GET = handler
export const POST = handler
