'use node'

import jwt from 'jsonwebtoken'

// https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app#about-json-web-tokens-jwts
export function createGithubAppJwt() {
    let secret = process.env.AUTH_GITHUB_PRIVATE_KEY!
    let issuer = process.env.AUTH_GITHUB_ID

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
