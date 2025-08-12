// Protected functions are meant to be called server-to-server. In development
// they are more like laptop-to-server, so this dramatically speeds up development.

import { v } from 'convex/values'
import * as models from './models/models'
import { protectedMutation } from './utils'

export const upsertInstallation = protectedMutation({
    args: {
        repoId: v.id('repos'),
        userId: v.id('users'),
        githubInstallationId: v.number(),
        token: v.string(),
        expiresAt: v.string(),
    },
    handler: async (ctx, args) => {
        let installation = await models.Installations.upsert(ctx, {
            repoId: args.repoId,
            userId: args.userId,
            githubInstallationId: args.githubInstallationId,
            suspended: false,
        })
        if (!installation) throw new Error('installation not found')

        let installationAccessToken = await models.InstallationAccessTokens.upsert(ctx, {
            installationId: installation._id,
            token: args.token,
            expiresAt: args.expiresAt,
        })
        if (!installationAccessToken) throw new Error('installation access token not found')

        return {
            installation,
            accessToken: installationAccessToken,
        }
    },
})
