import { auth } from '@/auth'
import { polar } from '@/polar'
import { prisma } from '@/lib/db'
import { redisGet, redisSet } from '@/lib/redis'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound'
import { Octokit } from 'octokit'
import { z } from 'zod'

const ETAG_CACHING = true

export const UNAUTHORIZED_ERROR = 'unauthorized'
export const NO_SUBSCRIPTION_ERROR = 'no_subscription'

async function timedRequest<T>(
    cacheKey: string,
    request: (headers: {
        'If-None-Match'?: string
    }) => Promise<{ data: T; headers: { etag?: string } }>,
    headers: { 'If-None-Match'?: string },
): Promise<{ data: T; headers: { etag?: string } }> {
    const start = performance.now()
    try {
        const response = await request(headers)
        console.log(
            `\x1b[33m${cacheKey}: ${(performance.now() - start).toFixed(0)}ms\x1b[0m \x1b[31m(not cached)\x1b[0m`,
        )
        return response
    } catch (error) {
        if (isErrEtagCached(error)) {
            console.log(
                `\x1b[33m${cacheKey}: ${(performance.now() - start).toFixed(0)}ms\x1b[0m \x1b[32m(etag cached)\x1b[0m`,
            )
        } else {
            console.log(
                `\x1b[33m${cacheKey}: ${(performance.now() - start).toFixed(0)}ms\x1b[0m \x1b[31m(error)\x1b[0m`,
            )
        }
        throw error
    }
}

type User = {
    userId: string
    token: string
}

async function assertUser(): Promise<User> {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
        throw new Error(UNAUTHORIZED_ERROR)
    }

    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: 'github',
        },
    })

    if (!account?.accessToken) {
        throw new Error(UNAUTHORIZED_ERROR)
    }

    try {
        const customerState = await polar.customers.getStateExternal({
            externalId: session.user.id,
        })

        if (customerState?.activeSubscriptions?.length === 0) {
            throw new Error(NO_SUBSCRIPTION_ERROR)
        }
    } catch (error) {
        // Customer not found in Polar yet (404 ResourceNotFound)
        // This is expected for new users who haven't completed checkout yet
        if (error instanceof ResourceNotFound) {
            throw new Error(NO_SUBSCRIPTION_ERROR)
        } else {
            throw error
        }
    }

    return { userId: session.user.id, token: account.accessToken }
}

function newOcto(token: string) {
    return new Octokit({ auth: token })
}

function isErrEtagCached(error: unknown) {
    return error instanceof Error && 'status' in error && error.status === 304
}

// Note: for paging requests, use cachedRequest only for the first page. If page 1 changes, all subsequent pages
// are likely invalid due to shifted offsets. Uncached pages stay consistent with current state.
async function cachedRequest<T>(
    userId: string,
    cacheKey: string,
    request: (headers: {
        'If-None-Match'?: string
    }) => Promise<{ data: T; headers: { etag?: string } }>,
): Promise<T> {
    const dataKey = `data:${cacheKey}`
    const etagKey = `etag:${userId}:${cacheKey}`

    if (!ETAG_CACHING) {
        const response = await timedRequest(cacheKey, request, {})
        return response.data
    }

    const [cachedData, userEtag] = await Promise.all([redisGet(dataKey), redisGet<string>(etagKey)])

    const headers = typeof userEtag === 'string' ? { 'If-None-Match': userEtag } : {}

    try {
        const response = await timedRequest(cacheKey, request, headers)

        if (response.headers.etag) {
            await Promise.all([
                redisSet(dataKey, response.data),
                redisSet(etagKey, response.headers.etag),
            ])
        }

        return response.data
    } catch (error: unknown) {
        if (cachedData && isErrEtagCached(error)) {
            console.debug('\x1b[36mreturning cached response\x1b[0m')
            return cachedData as T
        }
        throw error
    }
}

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
        let user = await assertUser()
        let octo = newOcto(user.token)

        const pullRequest = await cachedRequest(
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
        let user = await assertUser()
        let octo = newOcto(user.token)

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

        const pullRequests = await cachedRequest(
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
        let user = await assertUser()
        let octo = newOcto(user.token)

        const files = await cachedRequest(
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

const IssueSchema = z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    state: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    user: z.object({
        login: z.string(),
    }),
    labels: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            color: z.string(),
        }),
    ),
})

export type Issue = z.infer<typeof IssueSchema>

export const listIssues = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string() }))
    .handler(async ({ data }) => {
        let user = await assertUser()
        let octo = newOcto(user.token)

        const issues = await cachedRequest(
            user.userId,
            `issues:${data.owner}/${data.repo}`,
            (headers) =>
                octo.rest.issues.listForRepo({
                    owner: data.owner,
                    repo: data.repo,
                    headers,
                }),
        )

        return z.array(IssueSchema).parse(issues)
    })

const CommentSchema = z.object({
    id: z.number(),
    body: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    user: z.object({
        login: z.string(),
        avatar_url: z.string(),
    }),
})

export type Comment = z.infer<typeof CommentSchema>

export const getPRComments = createServerFn({ method: 'GET' })
    .inputValidator(
        z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            page: z.number().optional(),
        }),
    )
    .handler(async ({ data }) => {
        let user = await assertUser()
        let octo = newOcto(user.token)

        const page = data.page ?? 1
        if (page !== 1) {
            let res = await octo.rest.issues.listComments({
                owner: data.owner,
                repo: data.repo,
                issue_number: data.number,
                per_page: 30,
                page,
            })

            return res.data
        }

        const comments = await cachedRequest(
            user.userId,
            `pr-comments:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.issues.listComments({
                    owner: data.owner,
                    repo: data.repo,
                    issue_number: data.number,
                    per_page: 30,
                    page,
                    headers,
                }),
        )
        return z.array(CommentSchema).parse(comments)
    })

const ReviewCommentSchema = z.object({
    id: z.number(),
    body: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    user: z.object({
        login: z.string(),
        avatar_url: z.string(),
    }),
    commit_id: z.string(),
    original_commit_id: z.string(),
    diff_hunk: z.string(),
    path: z.string(),
    position: z.number().nullable(),
    original_position: z.number().nullable(),
    line: z.number().nullable(),
})

export type ReviewComment = z.infer<typeof ReviewCommentSchema>

export const getPRReviewComments = createServerFn({ method: 'GET' })
    .inputValidator(
        z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            page: z.number().optional(),
        }),
    )
    .handler(async ({ data }) => {
        let user = await assertUser()
        let octo = newOcto(user.token)

        const page = data.page ?? 1
        if (page !== 1) {
            let res = await octo.rest.pulls.listReviewComments({
                owner: data.owner,
                repo: data.repo,
                pull_number: data.number,
                per_page: 30,
                page,
            })

            return res.data
        }

        const comments = await cachedRequest(
            user.userId,
            `pr-review-comments:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.pulls.listReviewComments({
                    owner: data.owner,
                    repo: data.repo,
                    pull_number: data.number,
                    per_page: 30,
                    page,
                    headers,
                }),
        )
        return z.array(ReviewCommentSchema).parse(comments)
    })

const RepositorySchema = z.object({
    name: z.string(),
    description: z.string().nullable(),
    stargazers_count: z.number(),
    language: z.string().nullable(),
    html_url: z.string(),
})

export type Repository = z.infer<typeof RepositorySchema>

export const listOwnerRepos = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), page: z.number() }))
    .handler(async ({ data }) => {
        let user = await assertUser()
        let octo = newOcto(user.token)

        if (data.page !== 1) {
            let res = await octo.rest.repos.listForUser({
                username: data.owner,
                page: data.page,
                per_page: 10,
            })

            return z.array(RepositorySchema).parse(res.data)
        }

        const repositories = await cachedRequest(
            user.userId,
            `repos:${data.owner}:${data.page}`,
            (headers) =>
                octo.rest.repos.listForUser({
                    username: data.owner,
                    page: data.page,
                    per_page: 10,
                    headers,
                }),
        )

        return z.array(RepositorySchema).parse(repositories)
    })

const RepositoryStatsSchema = z.object({
    repository: z.object({
        openPullRequestCount: z.object({
            totalCount: z.number(),
        }),
        openIssueCount: z.object({
            totalCount: z.number(),
        }),
    }),
})

export type RepositoryStats = {
    openPullRequests: number
    openIssues: number
}

export const getRepositoryStats = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string() }))
    .handler(async ({ data }) => {
        let user = await assertUser()
        let octo = newOcto(user.token)

        const response = await octo.graphql(
            `query ($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                    openPullRequestCount: pullRequests(states: [OPEN]) {
                        totalCount
                    }
                    openIssueCount: issues(states: [OPEN]) {
                        totalCount
                    }
                }
            }`,
            { owner: data.owner, repo: data.repo },
        )

        const parsed = RepositoryStatsSchema.parse(response)

        const res: RepositoryStats = {
            openPullRequests: parsed.repository.openPullRequestCount.totalCount,
            openIssues: parsed.repository.openIssueCount.totalCount,
        }

        return res
    })
