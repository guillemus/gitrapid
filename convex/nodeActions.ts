'use node'

import jwt from 'jsonwebtoken'
import { internalAction } from './_generated/server'
import { env } from './env'

// https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app#about-json-web-tokens-jwts
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

export const logGithubAppJwt = internalAction({
    async handler() {
        let token = createGithubAppJwt()
        console.log(token)
    },
})

// export const generateGithubAppInstallationToken = internalAction({
//     args: {
//         userId: v.id('users'),
//         repoId: v.id('repos'),
//     },

//     async handler(ctx, { userId, repoId }): Promise<string> {
//         let savedRepo = await Repos.getByRepoId(ctx, repoId)

//         let existingToken = await ctx.runQuery(internal.queries.getInstallationToken, {
//             userId,
//             repoId,
//         })
//         if (!existingToken) {
//             throw new Error('No installation token found')
//         }

//         // If the token expires in more than 5 minutes, return it
//         const expiresAt = new Date(existingToken.expiresAt)
//         const nowPlus5Min = new Date(Date.now() + 1000 * 60 * 5)
//         if (expiresAt > nowPlus5Min) {
//             return existingToken.token
//         }

//         let token = createGithubAppJwt()
//         let octo = new Octokit({ auth: token })

//         let installation = await octo.apps.getRepoInstallation({ owner, repo })
//         let installationId = installation.data.id

//         let accessToken = await octo.apps.createInstallationAccessToken({
//             installation_id: installationId,
//         })

//         await ctx.runMutation(internal.mutations.saveInstallationToken, {
//             owner,
//             repo,
//             token: accessToken.data.token,
//             expiresAt: accessToken.data.expires_at,
//         })

//         console.log('github app jwt', token)
//         console.log('installation token', accessToken.data.token)

//         return accessToken.data.token
//     },
// })
