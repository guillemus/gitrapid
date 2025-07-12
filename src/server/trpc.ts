import {
    err,
    ok,
    transformFileContentsResponse,
    tryCatch,
    unwrap,
    type ResultP,
} from '@/shared/shared'
import { initTRPC } from '@trpc/server'
import type { AstroCookies } from 'astro'
import { z } from 'zod'
import { GitHubClient, type File, type Folder } from '../shared/github-client'
import { auth } from './auth'

export type Context = {
    request: Request
    cookies: AstroCookies
    locals: App.Locals
    setHeader: (key: string, val: string) => void
}

const t = initTRPC.context<Context>().create()

async function getUserOauthToken(ctx: Context): ResultP<string> {
    const accessToken = await tryCatch(
        auth.api.getAccessToken({
            body: { providerId: 'github' },
            headers: ctx.request.headers,
        }),
    )
    if (accessToken.error) return accessToken

    let token = accessToken.data.accessToken
    if (!token) return err('access token fetched but not found')

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
