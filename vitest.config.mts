import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            '@convex': resolve(root, 'convex'),
            '@': resolve(root, 'src'),
        },
    },
    test: {
        environment: 'edge-runtime',
        server: { deps: { inline: ['convex-test'] } },
    },
})
