import { Octokit } from '@octokit/rest'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { err, octoCatch, type Err } from './utils'

export const deleteInstallation = internalAction({
    args: {
        installationId: v.number(),
    },

    async handler(ctx, args): Promise<void | Err> {
        let token = await ctx.runAction(internal.nodeActions.createGithubAppToken)
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
