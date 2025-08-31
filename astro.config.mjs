// @ts-check
import 'dotenv/config'

import react from '@astrojs/react'
import vercel from '@astrojs/vercel'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

let adapter
if (process.env.USE_NODE === 'true') {
    adapter = node({ mode: 'standalone' })
} else {
    adapter = vercel()
}

export default defineConfig({
    output: 'server',
    integrations: [react()],
    devToolbar: { enabled: false },
    adapter,

    vite: { plugins: [tailwindcss()] },
})
