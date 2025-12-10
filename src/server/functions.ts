import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { syncSubscriptionByUserId } from '@/polar'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { server } from './server'

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
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        const issues = await server.cachedRequest(
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
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

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

        const comments = await server.cachedRequest(
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
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

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

        const comments = await server.cachedRequest(
            user.userId,
            `pr-review-comments:${data.owner}/${data.repo}/${data.number}`,
            (headers) =>
                octo.rest.pulls.listReviewComments({
                    owner: data.owner,
                    repo: data.repo,
                    pull_number: data.number,
                    per_page: 100,
                    page,
                    headers,
                }),
        )
        return z.array(ReviewCommentSchema).parse(comments)
    })

const RepositorySchema = z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
    description: z.string().nullable(),
    stargazers_count: z.number(),
    language: z.string().nullable(),
    html_url: z.string(),
})

export type Repository = z.infer<typeof RepositorySchema>

export const listOwnerRepos = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), page: z.number() }))
    .handler(async ({ data }) => {
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        if (data.page !== 1) {
            let res = await octo.rest.repos.listForUser({
                username: data.owner,
                page: data.page,
                per_page: 10,
            })

            return z.array(RepositorySchema).parse(res.data)
        }

        const repositories = await server.cachedRequest(
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
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

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

export const listMyRepos = createServerFn({ method: 'GET' }).handler(async () => {
    let user = await server.assertUser()
    let octo = server.newOcto(user.token)

    const repositories = await server.cachedRequest(user.userId, `my-repos`, (headers) =>
        octo.rest.repos.listForAuthenticatedUser({
            per_page: 10,
            sort: 'pushed',
            affiliation: 'owner',
            headers,
        }),
    )

    return z.array(RepositorySchema).parse(repositories)
})

export const getUser = createServerFn({ method: 'GET' }).handler(async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
        return null
    }

    const subscription = await prisma.subscription.findUnique({
        where: { userId: session.user.id },
    })

    return {
        user: session.user,
        session,
        subscription,
    }
})

export const syncSubscriptionAfterCheckout = createServerFn({ method: 'POST' }).handler(
    async () => {
        const request = getRequest()
        const session = await auth.api.getSession({ headers: request.headers })

        if (!session) {
            return { success: false, error: 'Not authenticated' }
        }

        try {
            await syncSubscriptionByUserId(session.user.id)
            return { success: true }
        } catch (error) {
            console.error('Sync failed:', error)
            return { success: false, error: 'Sync failed. Please refresh the page.' }
        }
    },
)

export const getRepositoryMetadata = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ owner: z.string(), repo: z.string() }))
    .handler(async ({ data }) => {
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        const repo = await server.cachedRequest(
            user.userId,
            `repo-metadata:${data.owner}/${data.repo}`,
            (headers) =>
                octo.rest.repos.get({
                    owner: data.owner,
                    repo: data.repo,
                    headers,
                }),
        )

        return { defaultBranch: repo.default_branch }
    })

export type FileContents = {
    content: string | null
    type: 'file' | 'dir'
}

export const getFileContents = createServerFn({ method: 'GET' })
    .inputValidator(
        z.object({
            owner: z.string(),
            repo: z.string(),
            ref: z.string().optional(),
            path: z.string().optional(),
        }),
    )
    .handler(async ({ data }) => {
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        let path = data.path ?? 'README.md'

        const fileResponse = await server.cachedRequest(
            user.userId,
            `file:${data.owner}/${data.repo}/${path}:${data.ref || 'default'}`,
            (headers) =>
                octo.rest.repos.getContent({
                    owner: data.owner,
                    repo: data.repo,
                    path: path,
                    ref: data.ref,
                    headers,
                }),
        )

        // Handle base64 decoding if it's a file
        if (Array.isArray(fileResponse)) {
            return null
        }

        const isFile = fileResponse.type === 'file'

        if (isFile && 'content' in fileResponse && fileResponse.content) {
            if (fileResponse.path) {
                let content = Buffer.from(fileResponse.content, 'base64').toString('utf-8')
                return {
                    path: fileResponse.path,
                    content,
                }
            }
        }

        return null
    })

const TreeItemSchema = z.object({
    path: z.string(),
    mode: z.string(),
    type: z.enum(['blob', 'tree', 'commit']),
    sha: z.string(),
    size: z.number().optional(),
    url: z.string(),
})

export type TreeItem = z.infer<typeof TreeItemSchema>

export const getRepositoryTree = createServerFn({ method: 'GET' })
    .inputValidator(
        z.object({
            owner: z.string(),
            repo: z.string(),
            branch: z.string().optional(),
        }),
    )
    .handler(async ({ data }) => {
        let user = await server.assertUser()
        let octo = server.newOcto(user.token)

        const tree = await server.cachedRequest(
            user.userId,
            `tree:${data.owner}/${data.repo}:${data.branch || 'default'}`,
            (headers) =>
                octo.rest.git.getTree({
                    owner: data.owner,
                    repo: data.repo,
                    tree_sha: data.branch || 'main',
                    recursive: true as unknown as 'true',
                    headers,
                }),
        )

        return z.array(TreeItemSchema).parse(tree.tree)
    })
