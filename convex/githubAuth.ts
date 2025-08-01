'use node'

import { Octokit } from '@octokit/rest'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { createGithubAppJwt } from './jwt'

export const logGithubAppJwt = internalAction({
    async handler() {
        let token = createGithubAppJwt()
        console.log(token)
    },
})

export const generateGithubAppInstallationToken = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo }): Promise<string> {
        let existingToken = await ctx.runQuery(internal.functions.getInstallationToken, {
            owner,
            repo,
        })
        if (!existingToken) {
            throw new Error('No installation token found')
        }

        // If the token expires in more than 5 minutes, return it
        const expiresAt = new Date(existingToken.expiresAt)
        const nowPlus5Min = new Date(Date.now() + 1000 * 60 * 5)
        if (expiresAt > nowPlus5Min) {
            return existingToken.token
        }

        let token = createGithubAppJwt()
        let octo = new Octokit({ auth: token })

        let installation = await octo.apps.getRepoInstallation({ owner, repo })
        let installationId = installation.data.id

        let accessToken = await octo.apps.createInstallationAccessToken({
            installation_id: installationId,
        })

        await ctx.runMutation(internal.mutations.saveInstallationToken, {
            owner,
            repo,
            token: accessToken.data.token,
            expiresAt: accessToken.data.expires_at,
        })

        console.log('github app jwt', token)
        console.log('installation token', accessToken.data.token)

        return accessToken.data.token
    },
})
