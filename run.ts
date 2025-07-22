import dotenv from 'dotenv'

import { GithubClient } from '@convex/GithubClient'
import { downloadAllRefs, type Context } from '@convex/utils'
import { ConvexHttpClient } from 'convex/browser'

dotenv.config()
dotenv.config({ override: true, path: '.env.local' })

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

await downloadAllRefs(ctx, githubClient, 'withastro', 'astro')
