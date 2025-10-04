// @ts-check
import 'dotenv/config'

import react from '@astrojs/react'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
    output: 'server',
    integrations: [react()],
    devToolbar: { enabled: false },
    adapter: vercel(),

    vite: {
        plugins: [
            tanstackRouter({
                target: 'react',
                autoCodeSplitting: true,
                routesDirectory: './src/routes',
                generatedRouteTree: './src/routeTree.gen.ts',
            }),
            tailwindcss(),
        ],
    },
})
