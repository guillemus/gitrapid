import { v } from 'convex/values'
import * as sync from './services/sync'
import { protectedAction, unwrap } from './utils'

export const installRepo = protectedAction({
    args: {
        githubUserId: v.number(),
        installationId: v.number(),
        repo: v.string(),
        owner: v.string(),
        private: v.boolean(),
    },

    async handler(ctx, args) {
        let install = await sync.installRepo({
            ctx,
            githubUserId: args.githubUserId,
            installationId: args.installationId,
            repo: args.repo,
            owner: args.owner,
            private: args.private,
        })
        unwrap(install)
    },
})
