// @ts-check
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'
import clerk from '@clerk/astro'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
    output: 'server',
    integrations: [clerk(), react()],
    devToolbar: { enabled: false },
    adapter: vercel(),

    server: {
        host: '0.0.0.0',
    },

    vite: {
        plugins: [tailwindcss()],
    },
})
