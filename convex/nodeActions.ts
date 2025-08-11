'use node'

import jwt from 'jsonwebtoken'
import { internalAction } from './_generated/server'
import { env } from './env'

// https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app#about-json-web-tokens-jwts
export const createGithubAppToken = internalAction({
    async handler() {
        let secret = env.AUTH_GITHUB_PRIVATE_KEY!
        let issuer = env.AUTH_GITHUB_ID

        let signed = jwt.sign(
            {
                iat: Math.floor(Date.now() / 1000) - 60,
            },
            secret,
            {
                expiresIn: '10m',
                issuer,
                algorithm: 'RS256',
            },
        )

        return signed
    },
})
