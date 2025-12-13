import { demoRepos } from '@/lib/demo-repos'
import { syncSubscriptionByUserId } from '@/polar'
import { appEnv } from '@/server/app-env'
import { prisma } from '@/server/db'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import * as server from './server'
import { ERR_NO_SUBSCRIPTION_FOUND, ERR_UNAUTHORIZED } from './shared'
import { createTRPCRouter, tProcedure, type TRPCContext } from './trpc'

export type * as routes from './router'

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

const RepositorySchema = z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
    description: z.string().nullable(),
    stargazers_count: z.number(),
    language: z.string().nullable(),
    html_url: z.string(),
})

export type Repository = z.infer<typeof RepositorySchema>

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

export type FileContents = {
    content: string | null
    type: 'file' | 'dir'
}

const TreeItemSchema = z.object({
    path: z.string(),
    mode: z.string(),
    type: z.enum(['blob', 'tree', 'commit']),
    sha: z.string(),
    size: z.number().optional(),
    url: z.string(),
})

export type TreeItem = z.infer<typeof TreeItemSchema>

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

const PRListSchema = z.array(PRSchema.omit({ changedFiles: true }))

export type PRList = z.infer<typeof PRListSchema>

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

type UserContext =
    | { mode: 'authenticated'; userId: string; token: string }
    | { mode: 'demo'; userId: string; token: string }

function isDemoRepo(owner: string, repo: string): boolean {
    return demoRepos.some(
        (demo) =>
            demo.owner.toLowerCase() === owner.toLowerCase() &&
            demo.repo.toLowerCase() === repo.toLowerCase(),
    )
}

async function getAuthenticatedUser(ctx: TRPCContext): Promise<{ userId: string; token: string }> {
    if (!ctx.session) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: ERR_UNAUTHORIZED })
    }

    const account = await prisma.account.findFirst({
        where: {
            userId: ctx.session.user.id,
            providerId: 'github',
        },
    })

    if (!account?.accessToken) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: ERR_UNAUTHORIZED })
    }

    const subscription = await prisma.subscription.findUnique({
        where: { userId: ctx.session.user.id },
    })

    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
        throw new TRPCError({ code: 'PAYMENT_REQUIRED', message: ERR_NO_SUBSCRIPTION_FOUND })
    }

    return { userId: ctx.session.user.id, token: account.accessToken }
}

// as we need
const APP_USER_ID = 'gitrapid-app'

async function getUserContext(ctx: TRPCContext, owner: string, repo: string): Promise<UserContext> {
    if (isDemoRepo(owner, repo)) {
        return { mode: 'demo', userId: APP_USER_ID, token: appEnv.GITHUB_TOKEN }
    }

    const user = await getAuthenticatedUser(ctx)
    return { mode: 'authenticated', ...user }
}

const listIssues = tProcedure
    .input(z.object({ owner: z.string(), repo: z.string() }))
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const issues = await server.cachedRequest(
            user.userId,
            `issues:${input.owner}/${input.repo}`,
            (headers) =>
                octo.rest.issues.listForRepo({
                    owner: input.owner,
                    repo: input.repo,
                    headers,
                }),
        )

        return z.array(IssueSchema).parse(issues)
    })

const getPRComments = tProcedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            page: z.number().optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const page = input.page ?? 1
        if (page !== 1) {
            const res = await octo.rest.issues.listComments({
                owner: input.owner,
                repo: input.repo,
                issue_number: input.number,
                per_page: 30,
                page,
            })

            return res.data
        }

        const comments = await server.cachedRequest(
            user.userId,
            `pr-comments:${input.owner}/${input.repo}/${input.number}`,
            (headers) =>
                octo.rest.issues.listComments({
                    owner: input.owner,
                    repo: input.repo,
                    issue_number: input.number,
                    per_page: 30,
                    page,
                    headers,
                }),
        )
        return z.array(CommentSchema).parse(comments)
    })

const getPRReviewComments = tProcedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            page: z.number().optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const page = input.page ?? 1
        if (page !== 1) {
            const res = await octo.rest.pulls.listReviewComments({
                owner: input.owner,
                repo: input.repo,
                pull_number: input.number,
                per_page: 30,
                page,
            })

            return res.data
        }

        const comments = await server.cachedRequest(
            user.userId,
            `pr-review-comments:${input.owner}/${input.repo}/${input.number}`,
            (headers) =>
                octo.rest.pulls.listReviewComments({
                    owner: input.owner,
                    repo: input.repo,
                    pull_number: input.number,
                    per_page: 100,
                    page,
                    headers,
                }),
        )
        return z.array(ReviewCommentSchema).parse(comments)
    })

const listOwnerRepos = tProcedure
    .input(z.object({ owner: z.string(), page: z.number() }))
    .query(async ({ input, ctx }) => {
        const user = await getAuthenticatedUser(ctx)
        const octo = server.newOcto(user.token)

        if (input.page !== 1) {
            const res = await octo.rest.repos.listForUser({
                username: input.owner,
                page: input.page,
                per_page: 10,
            })

            return z.array(RepositorySchema).parse(res.data)
        }

        const repositories = await server.cachedRequest(
            user.userId,
            `repos:${input.owner}:${input.page}`,
            (headers) =>
                octo.rest.repos.listForUser({
                    username: input.owner,
                    page: input.page,
                    per_page: 10,
                    headers,
                }),
        )

        return z.array(RepositorySchema).parse(repositories)
    })

const getRepositoryStats = tProcedure
    .input(z.object({ owner: z.string(), repo: z.string() }))
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

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
            { owner: input.owner, repo: input.repo },
        )

        const parsed = RepositoryStatsSchema.parse(response)

        return {
            openPullRequests: parsed.repository.openPullRequestCount.totalCount,
            openIssues: parsed.repository.openIssueCount.totalCount,
        }
    })

const listMyRepos = tProcedure.query(async ({ ctx }) => {
    const user = await getAuthenticatedUser(ctx)
    const octo = server.newOcto(user.token)

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

const getUser = tProcedure.query(async ({ ctx }) => {
    if (!ctx.session) {
        return null
    }

    const subscription = await prisma.subscription.findUnique({
        where: { userId: ctx.session.user.id },
    })

    return {
        user: ctx.session.user,
        session: ctx.session,
        subscription,
    }
})

const syncSubscriptionAfterCheckout = tProcedure.mutation(async ({ ctx }) => {
    if (!ctx.session) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        await syncSubscriptionByUserId(ctx.session.user.id)
        return { success: true }
    } catch (error) {
        console.error('Sync failed:', error)
        return { success: false, error: 'Sync failed. Please refresh the page.' }
    }
})

const getRepositoryMetadata = tProcedure
    .input(z.object({ owner: z.string(), repo: z.string() }))
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const repo = await server.cachedRequest(
            user.userId,
            `repo-metadata:${input.owner}/${input.repo}`,
            (headers) =>
                octo.rest.repos.get({
                    owner: input.owner,
                    repo: input.repo,
                    headers,
                }),
        )

        return { defaultBranch: repo.default_branch }
    })

const getFileContents = tProcedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            ref: z.string().optional(),
            path: z.string().optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const path = input.path ?? 'README.md'

        const fileResponse = await server.cachedRequest(
            user.userId,
            `file:${input.owner}/${input.repo}/${path}:${input.ref || 'default'}`,
            (headers) =>
                octo.rest.repos.getContent({
                    owner: input.owner,
                    repo: input.repo,
                    path: path,
                    ref: input.ref,
                    headers,
                }),
        )

        if (Array.isArray(fileResponse)) {
            return null
        }

        const isFile = fileResponse.type === 'file'

        if (isFile && 'content' in fileResponse && fileResponse.content) {
            if (fileResponse.path) {
                const content = Buffer.from(fileResponse.content, 'base64').toString('utf-8')
                return {
                    path: fileResponse.path,
                    content,
                }
            }
        }

        return null
    })

const getRepositoryTree = tProcedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            ref: z.string(),
        }),
    )
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const tree = await server.cachedRequest(
            user.userId,
            `tree:${input.owner}/${input.repo}:${input.ref || 'default'}`,
            (headers) =>
                octo.rest.git.getTree({
                    owner: input.owner,
                    repo: input.repo,
                    tree_sha: input.ref,
                    recursive: true as unknown as 'true',
                    headers,
                }),
        )

        return z.array(TreeItemSchema).parse(tree.tree)
    })

const getPR = tProcedure
    .input(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .query(async ({ input, ctx }): Promise<PR> => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const pullRequest = await server.cachedRequest(
            user.userId,
            `pr:${input.owner}/${input.repo}/${input.number}`,
            (headers) =>
                octo.rest.pulls.get({
                    owner: input.owner,
                    repo: input.repo,
                    pull_number: input.number,
                    headers,
                }),
        )

        return PRSchema.parse({
            ...pullRequest,
            changedFiles: pullRequest.changed_files,
        })
    })

const listPRs = tProcedure
    .input(
        z.object({
            owner: z.string(),
            repo: z.string(),
            page: z.number(),
            state: z.enum(['open', 'closed']),
        }),
    )
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        if (input.page !== 1 || input.state !== 'open') {
            const res = await octo.rest.pulls.list({
                owner: input.owner,
                repo: input.repo,
                page: input.page,
                per_page: 10,
                state: input.state,
            })

            return PRListSchema.parse(res.data)
        }

        const pullRequests = await server.cachedRequest(
            user.userId,
            `prs:${input.owner}/${input.repo}`,
            (headers) =>
                octo.rest.pulls.list({
                    owner: input.owner,
                    repo: input.repo,
                    page: input.page,
                    per_page: 10,
                    state: input.state,
                    headers,
                }),
        )

        return PRListSchema.parse(pullRequests)
    })

const getPRFiles = tProcedure
    .input(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const files = await server.cachedRequest(
            user.userId,
            `pr-files:${input.owner}/${input.repo}/${input.number}`,
            (headers) =>
                octo.rest.pulls.listFiles({
                    owner: input.owner,
                    repo: input.repo,
                    pull_number: input.number,
                    headers,
                }),
        )
        return z.array(PRFileSchema).parse(files)
    })

const RefSchema = z.object({
    name: z.string(),
    commit: z.object({
        sha: z.string(),
    }),
})

export type Ref = z.infer<typeof RefSchema>

const listRefs = tProcedure
    .input(z.object({ owner: z.string(), repo: z.string() }))
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        const octo = server.newOcto(user.token)

        const branches = await server.cachedRequest(
            user.userId,
            `branches:${input.owner}/${input.repo}`,
            (headers) =>
                octo.rest.repos.listBranches({
                    owner: input.owner,
                    repo: input.repo,
                    per_page: 100,
                    headers,
                }),
        )

        const tags = await server.cachedRequest(
            user.userId,
            `tags:${input.owner}/${input.repo}`,
            (headers) =>
                octo.rest.repos.listTags({
                    owner: input.owner,
                    repo: input.repo,
                    per_page: 100,
                    headers,
                }),
        )

        const branchRefs = z.array(RefSchema).parse(branches)
        const tagRefs = z.array(RefSchema).parse(tags)

        return {
            branches: branchRefs.map((b) => b.name),
            tags: tagRefs.map((t) => t.name),
        }
    })

export const appRouter = createTRPCRouter({
    listIssues,
    getPRComments,
    getPRReviewComments,
    listOwnerRepos,
    getRepositoryStats,
    listMyRepos,
    getUser,
    syncSubscriptionAfterCheckout,
    getRepositoryMetadata,
    getFileContents,
    getRepositoryTree,
    getPR,
    listPRs,
    getPRFiles,
    listRefs,
})

export type AppRouter = typeof appRouter
