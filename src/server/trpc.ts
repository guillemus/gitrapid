import { createClerkClient } from '@clerk/backend'
import { initTRPC } from '@trpc/server'
import { Redis } from '@upstash/redis'
import type { AstroCookies } from 'astro'
import { z } from 'zod'
import { GitHubClient } from '../shared/github-client'
import { err, ok, transformFileContentsResponse, unwrap } from '@/shared/shared'

const redis = new Redis({
    url: import.meta.env.UPSTASH_REDIS_URL,
    token: import.meta.env.UPSTASH_REDIS_SECRET,
})

let clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export type Context = {
    request: Request
    cookies: AstroCookies
    locals: App.Locals
    setHeader: (key: string, val: string) => void
}

const t = initTRPC.context<Context>().create()

async function getUserOauthToken(ctx: Context) {
    let userId = ctx.locals.auth().userId
    if (!userId) return err('unauthorized')

    let token = await redis.get<string>(userId)
    if (token) return ok(token)

    let oauthTokens = await clerkClient.users.getUserOauthAccessToken(userId, 'github')

    token = oauthTokens.data[0]?.token ?? null
    if (!token) return err('token not found')

    await redis.set(userId, token, { ex: 5 * 60 })

    return ok(token)
}

type File = {
    type: 'file'
    name: string
    path: string
    contents: string
}

type Folder = {
    type: 'folder'
    contents: {
        name: string
        path: string
        isDir: boolean
    }[]
}

const getGithubFile = t.procedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            ref: z.string(),
            path: z.string(),
        }),
    )
    .query(async ({ ctx, input }): Promise<File | Folder | null> => {
        // This resource will be bandwidth intensive, we should cache it ONLY on the
        // client browser side. If you are an llm reading this, do NOT cache
        // this on the CDN, we would have security issues for user private data.
        if (input.ref === 'HEAD') {
            ctx.setHeader('Cache-Control', 'private, max-age=300, must-revalidate')
        } else {
            ctx.setHeader('Cache-Control', 'private, max-age=30000, must-revalidate')
        }

        let token = await getUserOauthToken(ctx).then(unwrap)

        let githubClient = new GitHubClient(token)
        let fileContents = await githubClient.getFileContentByAPI(input).then(unwrap)

        return transformFileContentsResponse(fileContents)
    })

const searchCode = t.procedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            query: z.string(),
        }),
    )
    .query(async ({ ctx, input }) => {
        let token = await getUserOauthToken(ctx).then(unwrap)

        let githubClient = new GitHubClient(token)
        let res = await githubClient.searchCode(input.query, input.owner, input.repo).then(unwrap)

        return res
    })

export const appRouter = t.router({
    getGithubFile,
    searchCode,
})

export type AppRouter = typeof appRouter
