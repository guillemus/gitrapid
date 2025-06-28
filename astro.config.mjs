// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    output: 'server',
    integrations: [react()],
    devToolbar: { enabled: false },
    adapter: vercel(),

    vite: {
        plugins: [tailwindcss()],
    },
})
