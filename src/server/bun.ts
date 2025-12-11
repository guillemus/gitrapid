import app from './hono'

const server = Bun.serve({
    port: 3001,
    fetch: app.fetch,
})

console.log(`Hono server running at http://localhost:${server.port}`)
