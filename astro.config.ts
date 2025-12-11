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
    server: {
        port: 3000,
        allowedHosts,
    },

    vite: {
        plugins: [
            tanstackRouter({
                target: 'react',
                autoCodeSplitting: true,
            }) as any,
            tailwindcss(),
        ],
    },

    integrations: [react()],
    adapter: vercel(),
})
