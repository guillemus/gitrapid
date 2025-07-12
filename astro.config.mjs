// @ts-check
import react from '@astrojs/react'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
    output: 'server',
    integrations: [react()],
    devToolbar: { enabled: false },
    adapter: node({ mode: 'standalone' }),

    server: {
        // for railway, needs to be set like this
        host: '0.0.0.0',
    },

    vite: { plugins: [tailwindcss()] },
})
