import type { CommentData, IssueData, TimelineItemData, UpsertDoc } from '@convex/models/models'
import { logger, zodParse } from '@convex/utils'
import type { RequestParameters } from '@octokit/graphql/types'
import type { Octokit } from 'octokit'
import { z } from 'zod'
import { err, O, ok, wrap, type Result } from '../shared'
import { octoCatch, octoCatchGql, type GraphqlRateLimitError } from './github'

export const Graphql = {
    fetchIssuesPage,
    getNextCursor,
}

type Issue = {
    issue: IssueData
    body: string
    labels: Label[]
    assignees: UpsertDoc<'githubUsers'>[]
    comments: CommentData[]
    timelineItems: TimelineItemData[]
}

type Label = {
    githubId: string
    name: string
    color: string
}

type Assignee = {
    login: string
    avatarUrl: string
    githubId: number
}

async function fetchIssuesPage(
    octo: Octokit,
    args: {
        owner: string
        repo: string
        cursor?: string
        since?: string
    },
): R<{ issues: Issue[]; pageInfo: PageInfo }, FetchIssuesErrors> {
    let issuesPage = await fetchIssuesPageGraphQL(octo, {
        owner: args.owner,
        repo: args.repo,
        first: TOTALS_FIRST_FETCH.issues,
        after: args.cursor,
        since: args.since,
    })
    if (issuesPage.isErr) return issuesPage

    let itemsWithPendingDownloads = buildIssuesWithCommentsBatch(issuesPage.val.nodes)

    let issues: Issue[] = []
    for (let item of itemsWithPendingDownloads) {
        let issueLabels = item.pageItem.labels
        if (item.downloadLabels.isSome) {
            logger.debug('downloading labels')

            let issueNumber = item.downloadLabels.val.issueNumber

            let res = await iterateResource({
                resourceName: 'issueLabels',
                doFetch: (cursor) =>
                    fetchIssueLabelsGraphQL(octo, {
                        owner: args.owner,
                        repo: args.repo,
                        number: issueNumber,
                        first: TOTALS_ITER.labels,
                        after: cursor,
                    }),
            })
            if (res.isErr) return res

            for (let label of res.val) {
                issueLabels.push({
                    githubId: label.id,
                    name: label.name,
                    color: label.color,
                })
            }
        }

        let issueAssignees = item.pageItem.assignees
        if (item.downloadAssignees.isSome) {
            let issueNumber = item.downloadAssignees.val.issueNumber
            let res = await iterateResource({
                resourceName: 'issueAssignees',
                doFetch: (cursor) =>
                    fetchIssueAssigneesGraphQL(octo, {
                        owner: args.owner,
                        repo: args.repo,
                        number: issueNumber,
                        first: TOTALS_ITER.assignees,
                        after: cursor,
                    }),
            })
            if (res.isErr) return res

            for (let assignee of res.val) {
                issueAssignees.push({
                    githubId: assignee.databaseId,
                    login: assignee.login,
                    avatarUrl: assignee.avatarUrl,
                })
            }
        }

        let issueComments = item.pageItem.comments
        if (item.downloadComments.isSome) {
            let issueNumber = item.downloadComments.val.issueNumber
            let res = await iterateResource({
                resourceName: 'issueComments',
                doFetch: (cursor) =>
                    fetchIssueCommentsGraphQL(octo, {
                        owner: args.owner,
                        repo: args.repo,
                        number: issueNumber,
                        first: TOTALS_ITER.comments,
                        after: cursor,
                    }),
            })
            if (res.isErr) return res

            for (let comment of res.val) {
                issueComments.push({
                    githubId: comment.databaseId,
                    author: gqlGithubUserToDbGithubUser(comment.author),
                    body: comment.body,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt,
                })
            }
        }

        let issueTimelineItems = item.pageItem.timelineItems
        if (!item.downloadTimelineItems.isNone) {
            let issueNumber = item.downloadTimelineItems.val.issueNumber
            let res = await iterateResource({
                resourceName: 'issueTimelineItems',
                doFetch: (cursor) =>
                    fetchIssueTimelineItemsGraphQL(octo, {
                        owner: args.owner,
                        repo: args.repo,
                        number: issueNumber,
                        first: TOTALS_ITER.timelineItems,
                        after: cursor,
                    }),
            })
            if (res.isErr) return res

            for (let timelineItem of res.val) {
                let t = parseTimelineItem(timelineItem)
                if (t.isErr) {
                    logger.error(
                        { issueNumber: item.pageItem.issue.number, timelineItem },
                        `invalid timeline item, skipping. err: ${t.err}`,
                    )
                    continue
                }

                issueTimelineItems.push(t.val)
            }
        }

        issues.push({
            issue: item.pageItem.issue,
            body: item.pageItem.body,
            comments: item.pageItem.comments,
            labels: item.pageItem.labels,
            timelineItems: issueTimelineItems,
            assignees: issueAssignees,
        })
    }

    return ok({ issues, pageInfo: issuesPage.val.pageInfo })
}

const GqlGithubUserSchema = z
    .object({
        login: z.string(),
        databaseId: z.number().nullish(),
        avatarUrl: z.string().nullish(),
    })
    // If null means user doesn't exist no more (deleted, ghost), or other reasons.
    .nullable()

type PossibleGithubUser = UpsertDoc<'githubUsers'> | null | 'github-actions'

function gqlGithubUserToDbGithubUser(
    gqlUser: z.infer<typeof GqlGithubUserSchema>,
): PossibleGithubUser {
    let dbuser
    if (!gqlUser) {
        dbuser = null
    } else if (!gqlUser.databaseId || !gqlUser.avatarUrl) {
        dbuser = 'github-actions' as const
    } else {
        dbuser = {
            login: gqlUser.login,
            githubId: gqlUser.databaseId,
            avatarUrl: gqlUser.avatarUrl,
        }
    }

    return dbuser
}

const GqlLabelSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
})

const GqlCommitSchema = z.object({
    oid: z.string(),
    url: z.string(),
})

const GqlRepoRefSchema = z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
})

const GqlCrossRefSourceSchema = z.discriminatedUnion('__typename', [
    z.object({
        __typename: z.literal('Issue'),
        number: z.number(),
        repository: GqlRepoRefSchema,
    }),
    z.object({
        __typename: z.literal('PullRequest'),
        number: z.number(),
        repository: GqlRepoRefSchema,
    }),
])

const IssueTimelineItemNodeSchema = z.discriminatedUnion('__typename', [
    z.object({
        __typename: z.literal('AssignedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        assignee: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('UnassignedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        assignee: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('LabeledEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        label: GqlLabelSchema,
    }),
    z.object({
        __typename: z.literal('UnlabeledEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        label: GqlLabelSchema,
    }),
    z.object({
        __typename: z.literal('MilestonedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        milestoneTitle: z.string(),
    }),
    z.object({
        __typename: z.literal('DemilestonedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        milestoneTitle: z.string(),
    }),
    z.object({
        __typename: z.literal('ClosedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('ReopenedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('RenamedTitleEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        previousTitle: z.string(),
        currentTitle: z.string(),
    }),
    z.object({
        __typename: z.literal('ReferencedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        commit: GqlCommitSchema,
    }),
    z.object({
        __typename: z.literal('CrossReferencedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        source: GqlCrossRefSourceSchema,
    }),
    z.object({
        __typename: z.literal('LockedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('UnlockedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('PinnedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('UnpinnedEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
    }),
    z.object({
        __typename: z.literal('TransferredEvent'),
        id: z.string(),
        createdAt: z.string(),
        actor: GqlGithubUserSchema,
        fromRepository: GqlRepoRefSchema,
    }),
])

const PageInfoSchema = z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().nullish(),
})

type PageInfo = z.infer<typeof PageInfoSchema>

let RateLimitSchema = z.object({
    cost: z.number(),
    remaining: z.number(),
    limit: z.number(),
    used: z.number(),
    resetAt: z.string(),
})

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function applyGraphqlBackpressure(rate: z.infer<typeof RateLimitSchema>): Promise<void> {
    let remaining = rate.remaining
    let resetMs = Math.max(0, new Date(rate.resetAt).getTime() - Date.now())
    if (remaining <= 50) {
        let jitter = Math.floor(Math.random() * 1000)
        await sleep(resetMs + jitter)
    }
}

// bc of how we do fetch data, there might be some object formats that we haven't defined correctly.
// if we parse each node individually we don't loose the others on a buggy fetch.
const toBeLaterParsed = z.unknown()

const FetchIssuesResSchema = z.object({
    repository: z.object({
        issues: z.object({
            nodes: z.array(toBeLaterParsed),
            pageInfo: PageInfoSchema,
        }),
    }),
})

type FetchIssuesRes = z.infer<typeof FetchIssuesResSchema>
type FetchIssueNode = FetchIssuesRes['repository']['issues']['nodes'][number]

const IssueNodeSchema = z.object({
    databaseId: z.number(),
    number: z.number(),
    title: z.string(),
    state: z.enum(['OPEN', 'CLOSED']),
    stateReason: z.enum(['COMPLETED', 'NOT_PLANNED', 'DUPLICATE', 'REOPENED']).nullish(),
    body: z
        .string()
        .nullish()
        .transform((v) => v ?? ''),
    createdAt: z.string(),
    updatedAt: z.string(),
    closedAt: z.string().nullish(),
    author: GqlGithubUserSchema,
    labels: z.object({
        pageInfo: PageInfoSchema,
        nodes: z.array(GqlLabelSchema),
    }),
    assignees: z.object({
        pageInfo: PageInfoSchema,
        nodes: z.array(GqlGithubUserSchema),
    }),
    comments: z.object({
        pageInfo: PageInfoSchema,
        nodes: z.array(toBeLaterParsed),
    }),
    timelineItems: z.object({
        pageInfo: PageInfoSchema,
        nodes: z.array(toBeLaterParsed),
    }),
})

// the max items to fetch on the first fetch.
const TOTALS_FIRST_FETCH = {
    issues: 10,
    labels: 10,
    assignees: 10,
    comments: 10,
    timelineItems: 10,
}

// the max items to fetch iteratively.
const TOTALS_ITER = {
    labels: 10,
    assignees: 10,
    comments: 10,
    timelineItems: 10,
}

type GetIssuesWithCommentsArgs = {
    owner: string
    repo: string
    first: number
    after?: string
    since?: string
}

let getIssuesWithCommentsQuery = `
    query GetIssuesWithComments($owner: String!, $repo: String!, $first: Int!, $after: String, $since: DateTime) {
        rateLimit { limit cost used remaining resetAt }
        repository(owner: $owner, name: $repo) {
            issues(
                first: $first, after: $after,
                orderBy: {
                    field: UPDATED_AT, direction: DESC
                },
                states: [OPEN, CLOSED],
                filterBy: { since: $since }
            ) {
                pageInfo { hasNextPage endCursor }
                nodes {
                    databaseId
                    number
                    title
                    state
                    stateReason
                    body
                    createdAt
                    updatedAt
                    closedAt
                    author { login ... on User { databaseId avatarUrl } }
                    labels(first: ${TOTALS_FIRST_FETCH.labels}) {
                        pageInfo { hasNextPage endCursor }
                        nodes { id name color }
                    }
                    assignees(first: ${TOTALS_FIRST_FETCH.assignees}) {
                        pageInfo { hasNextPage endCursor }
                        nodes { databaseId login avatarUrl }
                    }
                    comments(first: ${TOTALS_FIRST_FETCH.comments}) {
                        pageInfo { hasNextPage endCursor }
                        nodes {
                            databaseId
                            author { login ... on User { databaseId avatarUrl } }
                            body
                            createdAt
                            updatedAt
                        }
                    }
                    timelineItems(
                        first: ${TOTALS_FIRST_FETCH.timelineItems},
                        itemTypes: [
                            ASSIGNED_EVENT,
                            UNASSIGNED_EVENT,
                            LABELED_EVENT,
                            UNLABELED_EVENT,
                            MILESTONED_EVENT,
                            DEMILESTONED_EVENT,
                            CLOSED_EVENT,
                            REOPENED_EVENT,
                            RENAMED_TITLE_EVENT,
                            REFERENCED_EVENT,
                            CROSS_REFERENCED_EVENT,
                            LOCKED_EVENT,
                            UNLOCKED_EVENT,
                            PINNED_EVENT,
                            UNPINNED_EVENT
                        ]
                    ) {
                        pageInfo { hasNextPage endCursor }
                        nodes {
                            __typename
                            ... on AssignedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                assignee {
                                    ... on User { login databaseId avatarUrl }
                                    ... on Mannequin { login databaseId avatarUrl }
                                    ... on Organization { login: name databaseId: databaseId avatarUrl }
                                    ... on Bot { login databaseId avatarUrl }
                                }
                            }
                            ... on UnassignedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                assignee {
                                    ... on User { login databaseId avatarUrl }
                                    ... on Mannequin { login databaseId avatarUrl }
                                    ... on Organization { login: name databaseId: databaseId avatarUrl }
                                    ... on Bot { login databaseId avatarUrl }
                                }
                            }
                            ... on LabeledEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                label { id name color }
                            }
                            ... on UnlabeledEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                label { id name color }
                            }
                            ... on MilestonedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                milestoneTitle
                            }
                            ... on DemilestonedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                milestoneTitle
                            }
                            ... on ClosedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                            }
                            ... on ReopenedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                            }
                            ... on RenamedTitleEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                previousTitle
                                currentTitle
                            }
                            ... on ReferencedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                commit {
                                    oid
                                    url
                                }
                            }
                            ... on CrossReferencedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                source {
                                __typename
                                ... on Issue {
                                    number
                                    repository { name owner { login } }
                                }
                                ... on PullRequest {
                                    number
                                    repository { name owner { login } }
                                }
                                }
                            }
                            ... on LockedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                            }
                            ... on UnlockedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                            }
                            ... on PinnedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                            }
                            ... on UnpinnedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                            }
                            ... on TransferredEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId avatarUrl } }
                                fromRepository { name owner { login } }
                            }
                        }
                    }
                }
            }
        }
    }
`

type FetchIssuesErrors =
    | { type: 'ERROR'; err: string }
    | { type: 'RATE_LIMIT_ERROR'; err: GraphqlRateLimitError }

let FetchIssuesWithRateLimitResSchema = z.object({
    rateLimit: RateLimitSchema,
    repository: z.object({
        issues: z.object({
            nodes: z.array(toBeLaterParsed),
            pageInfo: PageInfoSchema,
        }),
    }),
})

async function fetchIssuesPageGraphQL(
    octo: Octokit,
    args: GetIssuesWithCommentsArgs,
): R<FetchIssuesRes['repository']['issues'], FetchIssuesErrors> {
    let res = await doGraphqlFetchRequest(
        octo,
        fetchIssuesPageGraphQL.name,
        getIssuesWithCommentsQuery,
        args,
        FetchIssuesWithRateLimitResSchema,
    )
    if (res.isErr) return res

    logger.debug(
        {
            cost: res.val.rateLimit.cost,
            used: res.val.rateLimit.used,
            remaining: res.val.rateLimit.remaining,
            limit: res.val.rateLimit.limit,
        },
        'graphql rateLimit',
    )

    await applyGraphqlBackpressure(res.val.rateLimit)

    return ok(res.val.repository.issues)
}

const FetchIssueLabelsResSchema = z.object({
    repository: z.object({
        issue: z.object({
            labels: z.object({
                pageInfo: PageInfoSchema,
                nodes: z.array(GqlLabelSchema),
            }),
        }),
    }),
})

type GetIssueLabelsArgs = {
    owner: string
    repo: string
    number: number
    first: number
    after?: string
}

let getIssueLabelsQuery = `
    query GetIssueLabels($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            issue(number: $number) {
                labels(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes { id name color }
                }
            }
        }
    }
`

type IssueLabelsRes = z.infer<typeof FetchIssueLabelsResSchema>['repository']['issue']['labels']

async function fetchIssueLabelsGraphQL(
    octo: Octokit,
    args: GetIssueLabelsArgs,
): R<IssueLabelsRes, FetchIssuesErrors> {
    let res = await doGraphqlFetchRequest(
        octo,
        fetchIssueLabelsGraphQL.name,
        getIssueLabelsQuery,
        args,
        FetchIssueLabelsResSchema,
    )
    if (res.isErr) return res

    return ok(res.val.repository.issue.labels)
}

const FetchIssueAssigneesResSchema = z.object({
    repository: z.object({
        issue: z.object({
            assignees: z.object({
                pageInfo: PageInfoSchema,
                nodes: z.array(
                    z.object({
                        databaseId: z.number(),
                        login: z.string(),
                        avatarUrl: z.string(),
                    }),
                ),
            }),
        }),
    }),
})

type GetIssueAssigneesArgs = {
    owner: string
    repo: string
    number: number
    first: number
    after?: string
}

let getIssueAssigneesQuery = `
    query GetIssueAssignees($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            issue(number: $number) {
                assignees(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes { databaseId login avatarUrl }
                }
            }
        }
    }
`

type IssueAssigneesRes = z.infer<
    typeof FetchIssueAssigneesResSchema
>['repository']['issue']['assignees']

async function fetchIssueAssigneesGraphQL(
    octo: Octokit,
    args: GetIssueAssigneesArgs,
): R<IssueAssigneesRes, FetchIssuesErrors> {
    let res = await doGraphqlFetchRequest(
        octo,
        fetchIssueAssigneesGraphQL.name,
        getIssueAssigneesQuery,
        args,
        FetchIssueAssigneesResSchema,
    )
    if (res.isErr) return res

    return ok(res.val.repository.issue.assignees)
}

const CommentSchema = z.object({
    databaseId: z.number(),
    author: GqlGithubUserSchema,
    body: z
        .string()
        .nullish()
        .transform((v) => v ?? ''),
    createdAt: z.string(),
    updatedAt: z.string(),
})

const FetchIssueCommentsResSchema = z.object({
    repository: z.object({
        issue: z.object({
            comments: z.object({
                pageInfo: PageInfoSchema,
                nodes: z.array(CommentSchema),
            }),
        }),
    }),
})

type GetIssueCommentsArgs = {
    owner: string
    repo: string
    number: number
    first: number
    after?: string
}

let getIssueCommentsQuery = `
    query GetIssueComments($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            issue(number: $number) {
                comments(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        databaseId
                        author { login avatarUrl ... on User { databaseId } }
                        body
                        createdAt
                        updatedAt
                    }
                }
            }
        }
    }
`

type IssueCommentsRes = z.infer<
    typeof FetchIssueCommentsResSchema
>['repository']['issue']['comments']

async function fetchIssueCommentsGraphQL(
    octo: Octokit,
    args: GetIssueCommentsArgs,
): R<IssueCommentsRes, FetchIssuesErrors> {
    let res = await doGraphqlFetchRequest(
        octo,
        fetchIssueCommentsGraphQL.name,
        getIssueCommentsQuery,
        args,
        FetchIssueCommentsResSchema,
    )
    if (res.isErr) return res

    return ok(res.val.repository.issue.comments)
}

const FetchIssueTimelineItemsResSchema = z.object({
    repository: z.object({
        issue: z.object({
            timelineItems: z.object({
                pageInfo: PageInfoSchema,
                nodes: z.array(toBeLaterParsed),
            }),
        }),
    }),
})

type GetIssueTimelineItemsArgs = {
    owner: string
    repo: string
    number: number
    first: number
    after?: string
}

let getIssueTimelineItemsQuery = `
    query GetIssueTimelineItems($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            issue(number: $number) {
                timelineItems(
                    first: $first,
                    after: $after,
                    itemTypes: [
                        ASSIGNED_EVENT,
                        UNASSIGNED_EVENT,
                        LABELED_EVENT,
                        UNLABELED_EVENT,
                        MILESTONED_EVENT,
                        DEMILESTONED_EVENT,
                        CLOSED_EVENT,
                        REOPENED_EVENT,
                        RENAMED_TITLE_EVENT,
                        REFERENCED_EVENT,
                        CROSS_REFERENCED_EVENT,
                        LOCKED_EVENT,
                        UNLOCKED_EVENT,
                        PINNED_EVENT,
                        UNPINNED_EVENT,
                        TRANSFERRED_EVENT
                    ]
                ) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        __typename
                        ... on AssignedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            assignee {
                                ... on User { login databaseId avatarUrl }
                                ... on Mannequin { login databaseId avatarUrl }
                                ... on Organization { login: name databaseId: databaseId avatarUrl }
                                ... on Bot { login databaseId avatarUrl }
                            }
                        }
                        ... on UnassignedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            assignee {
                                ... on User { login databaseId avatarUrl }
                                ... on Mannequin { login databaseId avatarUrl }
                                ... on Organization { login: name databaseId: databaseId avatarUrl }
                                ... on Bot { login databaseId avatarUrl }
                            }
                        }
                        ... on LabeledEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            label { id name color }
                        }
                        ... on UnlabeledEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            label { id name color }
                        }
                        ... on MilestonedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            milestoneTitle
                        }
                        ... on DemilestonedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            milestoneTitle
                        }
                        ... on ClosedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                        }
                        ... on ReopenedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                        }
                        ... on RenamedTitleEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            previousTitle
                            currentTitle
                        }
                        ... on ReferencedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            commit { oid url }
                        }
                        ... on CrossReferencedEvent {
                            id
                            createdAt
                            actor { login avatarUrl ... on User { databaseId } }
                            source {
                                __typename
                                ... on Issue { number repository { name owner { login } } }
                                ... on PullRequest { number repository { name owner { login } } }
                            }
                        }
                        ... on LockedEvent { id createdAt actor { login avatarUrl ... on User { databaseId } } }
                        ... on UnlockedEvent { id createdAt actor { login avatarUrl ... on User { databaseId } } }
                        ... on PinnedEvent { id createdAt actor { login avatarUrl ... on User { databaseId } } }
                        ... on UnpinnedEvent { id createdAt actor { login avatarUrl ... on User { databaseId } } }
                        ... on TransferredEvent { id createdAt actor { login avatarUrl ... on User { databaseId } } fromRepository { name owner { login } } }
                    }
                }
            }
        }
    }
`

type IssueTimelineItemsRes = z.infer<
    typeof FetchIssueTimelineItemsResSchema
>['repository']['issue']['timelineItems']

async function fetchIssueTimelineItemsGraphQL(
    octo: Octokit,
    args: GetIssueTimelineItemsArgs,
): R<IssueTimelineItemsRes, FetchIssuesErrors> {
    let res = await doGraphqlFetchRequest(
        octo,
        fetchIssueTimelineItemsGraphQL.name,
        getIssueTimelineItemsQuery,
        args,
        FetchIssueTimelineItemsResSchema,
    )
    if (res.isErr) return res

    return ok(res.val.repository.issue.timelineItems)
}

type IssuesPageItem = {
    issue: IssueData
    body: string
    author: PossibleGithubUser
    labels: Label[]
    assignees: UpsertDoc<'githubUsers'>[]
    comments: CommentData[]
    timelineItems: TimelineItemData[]
}

function buildIssuesWithCommentsBatch(fetchedIssues: FetchIssueNode[]) {
    type IssueId = { issueNumber: number }
    let items: {
        pageItem: IssuesPageItem
        downloadLabels: O<IssueId>
        downloadAssignees: O<IssueId>
        downloadComments: O<IssueId>
        downloadTimelineItems: O<IssueId>
    }[] = []

    for (let nodeUnknown of fetchedIssues) {
        let parsed = zodParse(IssueNodeSchema, nodeUnknown)
        if (parsed.isErr) {
            logger.error(`invalid issue node, skipping. err: ${parsed.err}`)
            continue
        }
        let issue = parsed.val

        let downloadLabels = O.none<IssueId>()
        if (issue.labels.pageInfo.hasNextPage) {
            downloadLabels = O.some({ issueNumber: issue.number })
        }

        let downloadAssignees = O.none<IssueId>()
        if (issue.assignees.pageInfo.hasNextPage) {
            downloadAssignees = O.some({ issueNumber: issue.number })
        }
        let downloadComments = O.none<IssueId>()
        if (issue.comments.pageInfo.hasNextPage) {
            downloadComments = O.some({ issueNumber: issue.number })
        }

        let downloadTimelineItems = O.none<IssueId>()
        if (issue.timelineItems.pageInfo.hasNextPage) {
            downloadTimelineItems = O.some({ issueNumber: issue.number })
        }

        let issueDoc = issueNodeToIssueDoc(issue)
        if (issueDoc.isErr) {
            logger.error(
                { issueNumber: issue.number },
                `failed to convert issue node to issue doc: ${issueDoc.err}`,
            )
            continue
        }

        let assignees: Assignee[] = []
        for (let a of issue.assignees.nodes) {
            if (a !== null && a.avatarUrl && a.databaseId) {
                assignees.push({
                    avatarUrl: a.avatarUrl,
                    githubId: a.databaseId,
                    login: a.login,
                })
            }
        }

        let labels: Label[] = issue.labels.nodes.map((l) => ({
            githubId: l.id,
            name: l.name,
            color: l.color,
        }))

        let timelineItems: TimelineItemData[] = []
        for (let node of issue.timelineItems.nodes) {
            let t = parseTimelineItem(node)
            if (t.isErr) {
                logger.error(
                    { issueNumber: issue.number, timelineItem: node },
                    `invalid timeline item, skipping. err: ${t.err}`,
                )
                continue
            }
            timelineItems.push(t.val)
        }

        let pageItem: IssuesPageItem = {
            issue: issueDoc.val,
            body: issue.body,
            author: gqlGithubUserToDbGithubUser(issue.author),
            assignees,
            labels,
            timelineItems,
            comments: issueNodeToCommentsForInsert(issue),
        }

        items.push({
            pageItem,
            downloadLabels,
            downloadAssignees,
            downloadComments,
            downloadTimelineItems,
        })
    }

    return items
}

type IssueNode = z.infer<typeof IssueNodeSchema>

function issueNodeToIssueDoc(node: IssueNode): Result<IssueData> {
    let state: 'open' | 'closed' = node.state === 'CLOSED' ? 'closed' : 'open'
    let stateReason
    if (node.stateReason === 'COMPLETED') {
        stateReason = 'completed' as const
    } else if (node.stateReason === 'NOT_PLANNED') {
        stateReason = 'not_planned' as const
    } else if (node.stateReason === 'DUPLICATE') {
        stateReason = 'duplicate' as const
    } else if (node.stateReason === 'REOPENED') {
        stateReason = 'reopened' as const
    }

    let author = gqlGithubUserToDbGithubUser(node.author)

    let doc: IssueData = {
        githubId: node.databaseId,
        number: node.number,
        title: node.title,
        author,
        state,
        stateReason,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        closedAt: node.closedAt ?? undefined,
        comments: node.comments.nodes.length,
    }

    return ok(doc)
}

function issueNodeToCommentsForInsert(issue: IssueNode): CommentData[] {
    let comments: CommentData[] = []
    for (let unparsedComment of issue.comments.nodes) {
        let comment = zodParse(CommentSchema, unparsedComment)
        if (comment.isErr) {
            logger.error(
                { comment: unparsedComment },
                `invalid issue comment, skipping. err: ${comment.err}`,
            )
            continue
        }
        let author = gqlGithubUserToDbGithubUser(comment.val.author)

        comments.push({
            githubId: comment.val.databaseId,
            author,
            body: comment.val.body,
            createdAt: comment.val.createdAt,
            updatedAt: comment.val.updatedAt,
        })
    }

    return comments
}

function parseTimelineItem(data: unknown): Result<TimelineItemData> {
    let t = zodParse(IssueTimelineItemNodeSchema, data)
    if (t.isErr) {
        return wrap(`invalid timeline item, skipping`, t)
    }

    let item: TimelineItemData['item']

    if (t.val.__typename === 'AssignedEvent') {
        item = {
            type: 'assigned',
            assignee: gqlGithubUserToDbGithubUser(t.val.actor),
        }
    } else if (t.val.__typename === 'UnassignedEvent') {
        item = {
            type: 'unassigned',
            assignee: gqlGithubUserToDbGithubUser(t.val.actor),
        }
    } else if (t.val.__typename === 'LabeledEvent') {
        item = {
            type: 'labeled',
            label: {
                githubId: t.val.label.id,
                name: t.val.label.name,
                color: t.val.label.color,
            },
        }
    } else if (t.val.__typename === 'UnlabeledEvent') {
        item = {
            type: 'unlabeled',
            label: {
                githubId: t.val.label.id,
                name: t.val.label.name,
                color: t.val.label.color,
            },
        }
    } else if (t.val.__typename === 'MilestonedEvent') {
        item = {
            type: 'milestoned',
            milestoneTitle: t.val.milestoneTitle,
        }
    } else if (t.val.__typename === 'DemilestonedEvent') {
        item = {
            type: 'demilestoned',
            milestoneTitle: t.val.milestoneTitle,
        }
    } else if (t.val.__typename === 'ClosedEvent') {
        item = {
            type: 'closed',
        }
    } else if (t.val.__typename === 'ReopenedEvent') {
        item = {
            type: 'reopened',
        }
    } else if (t.val.__typename === 'RenamedTitleEvent') {
        item = {
            type: 'renamed',
            previousTitle: t.val.previousTitle,
            currentTitle: t.val.currentTitle,
        }
    } else if (t.val.__typename === 'ReferencedEvent') {
        item = {
            type: 'referenced',
            commit: {
                oid: t.val.commit.oid,
                url: t.val.commit.url,
            },
        }
    } else if (t.val.__typename === 'CrossReferencedEvent') {
        item = {
            type: 'cross_referenced',
            source: {
                type: t.val.source.__typename,
                owner: t.val.source.repository.owner.login,
                name: t.val.source.repository.name,
                number: t.val.source.number,
            },
        }
    } else if (t.val.__typename === 'LockedEvent') {
        item = {
            type: 'locked',
        }
    } else if (t.val.__typename === 'UnlockedEvent') {
        item = {
            type: 'unlocked',
        }
    } else if (t.val.__typename === 'PinnedEvent') {
        item = {
            type: 'pinned',
        }
    } else if (t.val.__typename === 'UnpinnedEvent') {
        item = {
            type: 'unpinned',
        }
    } else if (t.val.__typename === 'TransferredEvent') {
        item = {
            type: 'transferred',
            fromRepository: {
                owner: t.val.fromRepository.owner.login,
                name: t.val.fromRepository.name,
            },
        }
    } else {
        let _ = t.val satisfies never
        return err(`unknown timeline item type`)
    }

    if (!t.val.id) {
        return err(`missing id field for timeline item`)
    }
    if (!t.val.createdAt) {
        return err(`missing createdAt field for timeline item`)
    }

    let actor = gqlGithubUserToDbGithubUser(t.val.actor)

    return ok({
        createdAt: t.val.createdAt,
        actor,
        item,
    })
}

function getNextCursor(pageInfo: PageInfo): O<{ cursor: string }> {
    if (pageInfo.hasNextPage) {
        if (pageInfo.endCursor) {
            return O.some({ cursor: pageInfo.endCursor })
        }
    }

    return O.none()
}

async function iterateResource<T, E>(args: {
    resourceName: string
    doFetch: (cursor?: string) => R<{ nodes: T[]; pageInfo: z.Infer<typeof PageInfoSchema> }, E>
}): R<T[], E> {
    let cursor: string | undefined
    let nodes: T[] = []

    while (true) {
        let res = await args.doFetch(cursor)
        if (res.isErr) return res

        logger.debug({ cursor }, args.resourceName)

        nodes.push(...res.val.nodes)

        let nextCursor = getNextCursor(res.val.pageInfo)
        if (nextCursor.isNone) {
            break
        }

        cursor = nextCursor.val.cursor
    }

    return ok(nodes)
}

async function doGraphqlFetchRequest<T>(
    octo: Octokit,
    label: string,
    query: string,
    args: RequestParameters,
    schema: z.ZodSchema<T>,
): R<T, FetchIssuesErrors> {
    let start = Date.now()
    let res = await octoCatchGql(octo.graphql(query, args))
    logger.debug(`${label}: ${Date.now() - start}ms`)

    if (res.isErr) {
        if (res.err.type === 'rate-limit-error') {
            return err({ type: 'RATE_LIMIT_ERROR', err: res.err.err })
        }

        return err({ type: 'ERROR', err: octoCatch.gqlErrToString(res) })
    }

    let parsed = zodParse(schema, res.val)
    if (parsed.isErr) {
        return err({ type: 'ERROR', err: parsed.err })
    }

    return ok(parsed.val)
}
