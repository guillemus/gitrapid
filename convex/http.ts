import { Webhooks } from '@octokit/webhooks'
import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { auth } from './auth'
import { env } from './env'
import { handleEvent } from './githubWebhooks'
import { logger } from './utils'

const http = httpRouter()

const webhooks = new Webhooks({
    secret: env.AUTH_GITHUB_WEBHOOK_SECRET!,
})

auth.addHttpRoutes(http)

http.route({
    method: 'POST',
    path: '/github/webhook',
    handler: httpAction(async (ctx, req) => {
        const signature = req.headers.get('x-hub-signature-256')
        if (!signature) {
            return new Response('Missing signature', { status: 401 })
        }

        const body = await req.text()

        try {
            const isValid = await webhooks.verify(body, signature)
            if (!isValid) {
                return new Response('Invalid signature', { status: 401 })
            }
        } catch (err) {
            return new Response('Signature verification error', { status: 401 })
        }

        const eventType = req.headers.get('x-github-event')
        if (!eventType) {
            return new Response('Missing event type', { status: 400 })
        }

        try {
            await handleEvent(ctx, eventType, body)
        } catch (parseError) {
            logger.error({ err: parseError }, 'Error parsing webhook payload')
            return new Response('Error parsing payload', { status: 400 })
        }

        return new Response('OK')
    }),
})

export default http
