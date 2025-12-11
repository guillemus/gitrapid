import { Hono } from 'hono'
import { trpcServer } from '@hono/trpc-server'
import { appRouter } from './router'
import { auth } from '@/auth'

const app = new Hono()

app.use(
    '/api/trpc/*',
    trpcServer({
        router: appRouter,
        createContext: (_opts, c) => ({
            req: c.req,
        }),
    }),
)
app.all('/api/auth/*', async (c) => {
    return auth.handler(c.req.raw)
})

export default app
