import { Octokit } from '@octokit/rest'
import { v } from 'convex/values'
import { api } from './_generated/api'
import { err, octoCatch, protectedAction, SECRET, type Err } from './utils'

export const deleteInstallation = protectedAction({
    args: {
        installationId: v.number(),
    },

    async handler(ctx, args): Promise<void | Err> {
        let token = await ctx.runAction(api.nodeActions.createGithubAppToken, SECRET)
        let octo = new Octokit({ auth: token })

        let res = await octoCatch(
            octo.rest.apps.deleteInstallation({ installation_id: args.installationId }),
        )
        if (res.isErr) {
            console.error(res.error.error())
            return err(res.error.error())
        }
    },
})
