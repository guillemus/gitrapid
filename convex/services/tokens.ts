import { env } from '@convex/env'
import jwt from 'jsonwebtoken'

export function createGithubAppJwt() {
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
}
