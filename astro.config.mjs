// @ts-check
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'
// import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
    output: 'server',
    integrations: [react()],
    devToolbar: { enabled: false },
    adapter: vercel(),
    // adapter: node({ mode: 'standalone' }),

    vite: { plugins: [tailwindcss()] },
})
