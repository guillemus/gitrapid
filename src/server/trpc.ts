import { createClerkClient } from '@clerk/backend'
import { initTRPC } from '@trpc/server'
import { Redis, type SetCommandOptions } from '@upstash/redis'
import type { AstroCookies } from 'astro'
import { z } from 'zod'
import { GitHubClient, type File, type Folder } from '../shared/github-client'
import {
    err,
    ok,
    transformFileContentsResponse,
    tryCatch,
    unwrap,
    type ResultP,
} from '@/shared/shared'

const redis = new Redis({
    url: import.meta.env.UPSTASH_REDIS_URL,
    token: import.meta.env.UPSTASH_REDIS_SECRET,
})

type RedisSchema = {
    token?: string
}

async function redisGet(key: string) {
    return redis.get<RedisSchema>(key)
}

async function redisSetKey(key: string, val: RedisSchema, opts?: SetCommandOptions) {
    return redis.set<RedisSchema>(key, val, opts)
}

let clerkClient = createClerkClient({ secretKey: import.meta.env.CLERK_SECRET_KEY })

export type Context = {
    request: Request
    cookies: AstroCookies
    locals: App.Locals
    setHeader: (key: string, val: string) => void
}

function timer(label: string) {
    let start = performance.now()
    return () => {
        console.log(`timer for ${label}: ${performance.now() - start}ms`)
    }
}

const t = initTRPC.context<Context>().create()

async function getUserOauthToken(ctx: Context): ResultP<string> {
    let userId = ctx.locals.auth().userId
    if (!userId) return err('unauthorized')

    let t = timer('redis.get')
    let user = await redisGet(userId)
    t()

    if (user?.token) return ok(user.token)

    t = timer('getUserOauthAccessToken')
    let oauthTokensRes = await tryCatch(clerkClient.users.getUserOauthAccessToken(userId, 'github'))
    t()

    if (oauthTokensRes.error) return oauthTokensRes

    let token = oauthTokensRes.data.data[0]?.token ?? null
    if (!token) return err('token not found')

    t = timer('redis.set')
    await redisSetKey(userId, { token }, { ex: 5 * 60 })
    t()

    return ok(token)
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
        let token = await getUserOauthToken(ctx).then(unwrap)

        let githubClient = new GitHubClient(token)
        let t = timer('getFileContentByAPI')
        let fileContents = await githubClient.getFileContentByAPI(input).then(unwrap)
        t()

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
