import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { server } from './server'

const PRBranch = z.object({
    ref: z.string(),
    repo: z
        .object({
            owner: z.object({
                login: z.string(),
            }),
            ref: z.string().optional(),
        })
        .nullable(),
})

const PRSchema = z.object({
    changedFiles: z.number(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    state: z.string(),
    title: z.string(),
    number: z.number(),
    body: z.string().nullable(),
    created_at: z.string(),
    milestone: z
        .object({
            title: z.string(),
        })
        .nullable(),
    labels: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            color: z.string(),
        }),
    ),
    user: z.object({
        login: z.string(),
        avatar_url: z.string(),
    }),
    base: PRBranch,
    head: PRBranch,
})

export type PR = z.infer<typeof PRSchema>

export const getPR = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .handler(async ({ data }): Promise<PR> => {
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        const pullRequest = await server.cachedRequest(
            user.userId,
            `pr:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.pulls.get({
                    owner: data.owner,
                    repo: data.repo,
                    pull_number: data.number,
                    headers,
                }),
        )

        return PRSchema.parse({
            ...pullRequest,
            changedFiles: pullRequest.changed_files,
        })
    })

const PRListSchema = z.array(PRSchema.omit({ changedFiles: true }))

export type PRList = z.infer<typeof PRListSchema>

export const listPRs = createServerFn({ method: 'GET' })
    .inputValidator(
        z.object({
            owner: z.string(),
            repo: z.string(),
            page: z.number(),
            state: z.enum(['open', 'closed']),
        }),
    )
    .handler(async ({ data }) => {
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        if (data.page !== 1 || data.state !== 'open') {
            let res = await octo.rest.pulls.list({
                owner: data.owner,
                repo: data.repo,
                page: data.page,
                per_page: 10,
                state: data.state,
            })

            return res.data
        }

        const pullRequests = await server.cachedRequest(
            user.userId,
            `prs:${data.owner}/${data.repo}`,
            (headers) =>
                octo.rest.pulls.list({
                    owner: data.owner,
                    repo: data.repo,
                    page: data.page,
                    per_page: 10,
                    state: data.state,
                    headers,
                }),
        )

        return PRListSchema.parse(pullRequests)
    })

const PRFileSchema = z.object({
    filename: z.string(),
    status: z.string(),
    additions: z.number(),
    deletions: z.number(),
    changes: z.number(),
    patch: z.string().optional(),
    blob_url: z.string(),
    raw_url: z.string(),
    contents_url: z.string(),
})

export type PRFile = z.infer<typeof PRFileSchema>

export const getPRFiles = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .handler(async ({ data }) => {
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        const files = await server.cachedRequest(
            user.userId,
            `pr-files:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.pulls.listFiles({
                    owner: data.owner,
                    repo: data.repo,
                    pull_number: data.number,
                    headers,
                }),
        )
        return z.array(PRFileSchema).parse(files)
    })
