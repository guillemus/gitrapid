import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    cacheComponents: true,
    /* config options here */
    allowedDevOrigins: ['dev.test', '*.dev.test'],
}

export default nextConfig
