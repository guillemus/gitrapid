import { tanstackRouter } from '@tanstack/router-vite-plugin'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

const allowedHosts = ['dev.test']
if (process.env.NGROK_HOST) {
    allowedHosts.push(process.env.NGROK_HOST)
}

export default defineConfig({
    server: {
        port: 3000,
        allowedHosts,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    plugins: [
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
        }),
        tsConfigPaths(),
        viteReact(),
    ],
})
