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
import { GitHubClient, parseRefAndPath, type File, type Folder } from '../shared/github-client'
import { auth } from './auth'
import { ref } from 'valtio'

export type Context = {
    request: Request
    cookies: AstroCookies
    locals: App.Locals
    setHeader: (key: string, val: string) => void
}

type Separated = {
    ref: string
    path: string
}

async function separatedRefAndPath(refAndPath: string): ResultP<Separated> {
    let parts = refAndPath.split('/')
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

const getBranches = t.procedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
        }),
    )
    .query(async ({ ctx, input }) => {
        let token = await getUserOauthToken(ctx).then(unwrap)

        let githubClient = new GitHubClient(token)

        // Get both repo info (for default branch) and branches
        let [repoInfo, branches] = await Promise.all([
            githubClient.getRepo(input.owner, input.repo).then(unwrap),
            githubClient.getBranches(input.owner, input.repo).then(unwrap),
        ])

        return {
            branches,
            defaultBranch: repoInfo.default_branch,
        }
    })

const parseRefAndPathProc = t.procedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            refAndPath: z.string(),
        }),
    )
    .query(async ({ ctx, input }) => {
        let token = await getUserOauthToken(ctx).then(unwrap)

        let githubClient = new GitHubClient(token)
        let parsed
        parsed = await parseRefAndPath(githubClient, input.owner, input.repo, input.refAndPath)
        parsed = unwrap(parsed)

        return parsed
    })

export const appRouter = t.router({
    getGithubFile,
    searchCode,
    getBranches,
    parseRefAndPathProc,
})

export type AppRouter = typeof appRouter
