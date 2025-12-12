import { defineConfig } from 'astro/config'
import { tanstackRouter } from '@tanstack/router-vite-plugin'

import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'

const allowedHosts = ['dev.test']
if (process.env.NGROK_HOST) {
    allowedHosts.push(process.env.NGROK_HOST)
}

// https://astro.build/config
export default defineConfig({
    output: 'server',
    devToolbar: { enabled: false },
    server: {
        port: 3000,
        allowedHosts,
    },

    vite: {
        plugins: [
            tailwindcss(),
            tanstackRouter({
                target: 'react',
                autoCodeSplitting: true,
            }) as any,
            {
                name: 'dev-rewrites',
                configureServer(server) {
                    server.middlewares.use(async (req, res, next) => {
                        const url = req.url || ''
                        // SPA navigation rewrite
                        const isNavigationRequest =
                            req.headers.accept?.includes('text/html') &&
                            req.method === 'GET' &&
                            !url.startsWith('/api') &&
                            !url.startsWith('/@') &&
                            !url.startsWith('/src') &&
                            !url.startsWith('/node_modules')
                        if (isNavigationRequest) {
                            req.url = '/app'
                        }
                        next()
                    })
                },
            },
        ],
        server: {
            proxy: {
                // BotID proxy for local development
                '/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/a-4-a/c.js':
                    {
                        target: 'https://api.vercel.com/bot-protection/v1/challenge',
                        changeOrigin: true,
                        rewrite: () => '',
                    },
                '/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3': {
                    target: 'https://api.vercel.com/bot-protection/v1/proxy',
                    changeOrigin: true,
                    rewrite: (path) =>
                        path.replace(
                            '/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3',
                            '',
                        ),
                },
            },
        },
    },

    integrations: [react()],
    adapter: vercel(),
})
