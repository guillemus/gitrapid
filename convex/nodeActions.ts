'use node'

import { Octokit } from 'octokit'
import { v } from 'convex/values'
import jwt from 'jsonwebtoken'
import { api } from './_generated/api'
import { SECRET, err, isErr, octoCatch, protectedAction } from './utils'
import { env } from './env'
import { PRIVATE_KEY } from './keys'

// https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app#about-json-web-tokens-jwts
export function jwtToken() {
    let secret = PRIVATE_KEY
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

export const createGithubAppToken = protectedAction({
    args: {},
    handler: jwtToken,
})

export const createGithubInstallationToken = protectedAction({
    args: {
        repoId: v.id('repos'),
        userId: v.id('users'),
        githubInstallationId: v.number(),
    },

    async handler(ctx, args) {
        let token = jwtToken()
        let octo = new Octokit({ auth: token })

        let accessToken = await octoCatch(
            octo.rest.apps.createInstallationAccessToken({
                installation_id: args.githubInstallationId,
            }),
        )
        if (isErr(accessToken)) {
            return err(`failed to create installation access token ${accessToken.error.error()}`)
        }

        await ctx.runMutation(api.protected.upsertInstallation, {
            ...SECRET,
            repoId: args.repoId,
            userId: args.userId,
            githubInstallationId: args.githubInstallationId,
            token: accessToken.token,
            expiresAt: accessToken.expires_at,
        })

        return accessToken.token
    },
})
