import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    server: {
        port: 3000,
        allowedHosts: ['dev.test'],
    },
    plugins: [
        tsConfigPaths(),
        tanstackStart({
            spa: { enabled: true },
            prerender: {
                enabled: true,
                autoSubfolderIndex: false,
            },
        }),
        nitro({ preset: 'vercel' }),
        // React's vite plugin must come after start's vite plugin
        viteReact(),
    ],
})
