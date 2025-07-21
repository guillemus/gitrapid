import 'dotenv/config'

import { GithubClient } from '@convex/GithubClient'
import { downloadAllRefs, type Context } from '@convex/utils'
import { ConvexHttpClient } from 'convex/browser'

const convexClient = new ConvexHttpClient(process.env.CONVEX_URL!)
const githubClient = new GithubClient(process.env.GITHUB_TOKEN)

let ctx: Context = {
    runQuery(query, ...args) {
        return convexClient.query(query, ...args)
    },
    runMutation(mutation, ...args) {
        return convexClient.mutation(mutation, ...args)
    },
}

await downloadAllRefs(ctx, githubClient, 'facebook', 'react')
