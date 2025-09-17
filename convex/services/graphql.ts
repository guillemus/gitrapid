import type { Id } from '@convex/_generated/dataModel'
import type { CommentForInsert, TimelineItemForInsert, UpsertDoc } from '@convex/models/models'
import type { GithubUser } from '@convex/schema'
import { logger, zodParse } from '@convex/utils'
import type { Octokit } from 'octokit'
import { z } from 'zod'
import { err, O, ok, type Result } from '../shared'
import { octoCatch, octoCatchGql, type GraphqlRateLimitError } from './github'

export const Graphql = {
    fetchIssues: fetchIssuesPageGraphQL,
    fetchIssueLabels: fetchIssueLabelsGraphQL,
    fetchIssueAssignees: fetchIssueAssigneesGraphQL,
    fetchIssueComments: fetchIssueCommentsGraphQL,
    fetchIssueTimelineItems: fetchIssueTimelineItemsGraphQL,

    buildIssuesWithCommentsBatch,
}

async function fetchIssues(
    octo: Octokit,
    args: {
        repoId: Id<'repos'>
        owner: string
        repo: string
        after?: string
        since?: string
    },
): R<IssuesPageItem[], FetchIssuesErrors> {
    let issuesPage = await fetchIssuesPageGraphQL(octo, {
        owner: args.owner,
        repo: args.repo,
        after: args.after,
        since: args.since,
    })
    if (issuesPage.isErr) return issuesPage

    let itemsWithPendingDownloads = buildIssuesWithCommentsBatch(args.repoId, issuesPage.val.nodes)

    for (let item of itemsWithPendingDownloads) {
        if (item.downloadLabels.isSome) {
            let cursor: string | undefined
            while (true) {
                let labels
                labels = await fetchIssueLabelsGraphQL(octo, {
                    owner: args.owner,
                    first: totals.labels,
                    repo: args.repo,
                    number: item.downloadLabels.val.issueId,
                    after: cursor,
                })
                if (labels.isErr) return labels

                labels = labels.val
                let newLabels = labels.nodes
                if (item.pageItem.issue.labels) {
                    item.pageItem.issue.labels.push(...newLabels)
                } else {
                    item.pageItem.issue.labels = newLabels
                }

                let nextCursor = getNextCursor(labels.pageInfo)
                if (nextCursor.isNone) {
                    break
                }

                cursor = nextCursor.val.cursor
            }
        }

        if (item.downloadAssignees.isSome) {
            let cursor: string | undefined
            while (true) {
                let assignees
                assignees = await fetchIssueAssigneesGraphQL(octo, {
                    owner: args.owner,
                    first: totals.assignees,
                    repo: args.repo,
                    number: item.downloadAssignees.val.issueId,
                    after: cursor,
                })
                if (assignees.isErr) return assignees

                assignees = assignees.val
                let newAssignees = assignees.nodes
                if (item.pageItem.issue.assignees) {
                    item.pageItem.issue.assignees.push(...newAssignees)
                } else {
                    item.pageItem.issue.assignees = newAssignees
                }

                let nextCursor = getNextCursor(assignees.pageInfo)
                if (nextCursor.isNone) {
                    break
                }

                cursor = nextCursor.val.cursor
            }
        }

        if (item.downloadComments.isSome) {
            let cursor: string | undefined
            while (true) {
                let comments
                comments = await fetchIssueCommentsGraphQL(octo, {
                    owner: args.owner,
                    first: totals.comments,
                    repo: args.repo,
                    number: item.downloadComments.val.issueId,
                    after: cursor,
                })
                if (comments.isErr) return comments

                comments = comments.val
                let newComments = comments.nodes

                let nextCursor = getNextCursor(comments.pageInfo)
                if (nextCursor.isNone) {
                    break
                }
            }
        }

        if (!item.downloadTimelineItems.isNone) {
            let cursor: string | undefined
            while (true) {
                let timelineItems
                timelineItems = await fetchIssueTimelineItemsGraphQL(octo, {
                    owner: args.owner,
                    first: totals.timelineItems,
                    repo: args.repo,
                    number: item.downloadTimelineItems.val.issueId,
                    after: cursor,
                })
                if (timelineItems.isErr) return timelineItems

                timelineItems = timelineItems.val
                let newTimelineItems = timelineItems.nodes

                let nextCursor = getNextCursor(timelineItems.pageInfo)
                if (nextCursor.isNone) {
                    break
                }

                cursor = nextCursor.val.cursor
            }
        }
    }

    return ok(items)
}

const GqlGithubUserSchema = z
    .object({
        login: z.string(),
        databaseId: z.number().nullish(),
    })
    // If null means user doesn't exist no more (deleted, ghost), or other reasons.
    .nullable()

function gqlGithubUserToDbGithubUser(gqlUser: z.infer<typeof GqlGithubUserSchema>): GithubUser {
    let dbuser
    if (!gqlUser) {
        dbuser = null
    } else if (!gqlUser.databaseId) {
        dbuser = 'github-actions' as const
    } else {
        dbuser = { login: gqlUser.login, id: gqlUser.databaseId }
    }

    return dbuser
}

const GqlLabelSchema = z.object({
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
        nodes: z.array(z.object({ login: z.string() })),
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

const totals = {
    issues: 100,
    labels: 100,
    assignees: 100,
    comments: 100,
    timelineItems: 100,
}

let getIssuesWithCommentsQuery = `
    query GetIssuesWithComments($owner: String!, $repo: String!, $first: Int!, $after: String, $since: DateTime) {
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
                    body
                    createdAt
                    updatedAt
                    closedAt
                    author { login ... on User { databaseId } }
                    labels(first: ${totals.labels}) { nodes { name color } }
                    assignees(first: ${totals.assignees}) { nodes { login } }
                    comments(first: ${totals.comments}) {
                        pageInfo { hasNextPage endCursor }
                        nodes {
                            databaseId
                            author { login ... on User { databaseId } }
                            body
                            createdAt
                            updatedAt
                        }
                    }
                    timelineItems(
                        first: ${totals.timelineItems},
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
                                actor { login ... on User { databaseId } }
                                assignee {
                                    ... on User { login databaseId }
                                    ... on Mannequin { login databaseId }
                                    ... on Organization { login: name databaseId: databaseId }
                                    ... on Bot { login databaseId }
                                }
                            }
                            ... on UnassignedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                                assignee {
                                    ... on User { login databaseId }
                                    ... on Mannequin { login databaseId }
                                    ... on Organization { login: name databaseId: databaseId }
                                    ... on Bot { login databaseId }
                                }
                            }
                            ... on LabeledEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                                label { name color }
                            }
                            ... on UnlabeledEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                                label { name color }
                            }
                            ... on MilestonedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                                milestoneTitle
                            }
                            ... on DemilestonedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                                milestoneTitle
                            }
                            ... on ClosedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                            }
                            ... on ReopenedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                            }
                            ... on RenamedTitleEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                                previousTitle
                                currentTitle
                            }
                            ... on ReferencedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                                commit {
                                    oid
                                    url
                                }
                            }
                            ... on CrossReferencedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
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
                                actor { login ... on User { databaseId } }
                            }
                            ... on UnlockedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                            }
                            ... on PinnedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                            }
                            ... on UnpinnedEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
                            }
                            ... on TransferredEvent {
                                id
                                createdAt
                                actor { login ... on User { databaseId } }
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

async function fetchIssuesPageGraphQL(
    octo: Octokit,
    args: {
        owner: string
        repo: string
        first?: number
        after?: string
        since?: string
    },
): R<FetchIssuesRes['repository']['issues'], FetchIssuesErrors> {
    console.time(fetchIssuesPageGraphQL.name)
    let res = await octoCatchGql(
        octo.graphql(getIssuesWithCommentsQuery, {
            owner: args.owner,
            repo: args.repo,
            first: args.first ?? totals.issues,
            after: args.after,
            since: args.since,
        }),
    )
    console.timeEnd(fetchIssuesPageGraphQL.name)
    if (res.isErr) {
        if (res.err.type === 'rate-limit-error') {
            return err({ type: 'RATE_LIMIT_ERROR', err: res.err.err })
        }

        return err({ type: 'ERROR', err: octoCatch.gqlErrToString(res) })
    }

    let parsed = zodParse(FetchIssuesResSchema, res.val)
    if (parsed.isErr) {
        return err({ type: 'ERROR', err: parsed.err })
    }

    return ok(parsed.val.repository.issues)
}

// -----------------------------
// Single issue paginated fetches
// -----------------------------

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

let getIssueLabelsQuery = `
    query GetIssueLabels($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            issue(number: $number) {
                labels(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes { name color }
                }
            }
        }
    }
`

async function fetchIssueLabelsGraphQL(
    octo: Octokit,
    args: { owner: string; repo: string; number: number; first: number; after?: string },
): R<
    z.infer<typeof FetchIssueLabelsResSchema>['repository']['issue']['labels'],
    FetchIssuesErrors
> {
    let res = await octoCatchGql(
        octo.graphql(getIssueLabelsQuery, {
            owner: args.owner,
            repo: args.repo,
            number: args.number,
            first: args.first,
            after: args.after,
        }),
    )
    if (res.isErr) {
        if (res.err.type === 'rate-limit-error') {
            return err({ type: 'RATE_LIMIT_ERROR', err: res.err.err })
        }

        return err({ type: 'ERROR', err: octoCatch.gqlErrToString(res) })
    }

    let parsed = zodParse(FetchIssueLabelsResSchema, res.val)
    if (parsed.isErr) {
        return err({ type: 'ERROR', err: parsed.err })
    }

    return ok(parsed.val.repository.issue.labels)
}

const FetchIssueAssigneesResSchema = z.object({
    repository: z.object({
        issue: z.object({
            assignees: z.object({
                pageInfo: PageInfoSchema,
                nodes: z.array(z.object({ login: z.string() })),
            }),
        }),
    }),
})

let getIssueAssigneesQuery = `
    query GetIssueAssignees($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            issue(number: $number) {
                assignees(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes { login }
                }
            }
        }
    }
`

async function fetchIssueAssigneesGraphQL(
    octo: Octokit,
    args: { owner: string; repo: string; number: number; first: number; after?: string },
): R<
    z.infer<typeof FetchIssueAssigneesResSchema>['repository']['issue']['assignees'],
    FetchIssuesErrors
> {
    let res = await octoCatchGql(
        octo.graphql(getIssueAssigneesQuery, {
            owner: args.owner,
            repo: args.repo,
            number: args.number,
            first: args.first,
            after: args.after,
        }),
    )
    if (res.isErr) {
        if (res.err.type === 'rate-limit-error') {
            return err({ type: 'RATE_LIMIT_ERROR', err: res.err.err })
        }

        return err({ type: 'ERROR', err: octoCatch.gqlErrToString(res) })
    }

    let parsed = zodParse(FetchIssueAssigneesResSchema, res.val)
    if (parsed.isErr) {
        return err({ type: 'ERROR', err: parsed.err })
    }

    return ok(parsed.val.repository.issue.assignees)
}

// Note: also used earlier for comment connection schema
// (kept here to preserve original ordering for issueNodeToCommentsForInsert)
const StrictIssueCommentSchema = z.object({
    databaseId: z.number(),
    author: GqlGithubUserSchema,
    body: z
        .string()
        .nullish()
        .transform((v) => v ?? ''),
    createdAt: z.string(),
    updatedAt: z.string(),
})

const StrictIssueCommentConnectionSchema = z.object({
    pageInfo: PageInfoSchema,
    nodes: z.array(StrictIssueCommentSchema),
})

const FetchIssueCommentsResSchema = z.object({
    repository: z.object({
        issue: z.object({ comments: StrictIssueCommentConnectionSchema }),
    }),
})

let getIssueCommentsQuery = `
    query GetIssueComments($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
            issue(number: $number) {
                comments(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        databaseId
                        author { login ... on User { databaseId } }
                        body
                        createdAt
                        updatedAt
                    }
                }
            }
        }
    }
`

async function fetchIssueCommentsGraphQL(
    octo: Octokit,
    args: { owner: string; repo: string; number: number; first: number; after?: string },
): R<
    z.infer<typeof FetchIssueCommentsResSchema>['repository']['issue']['comments'],
    FetchIssuesErrors
> {
    let res = await octoCatchGql(
        octo.graphql(getIssueCommentsQuery, {
            owner: args.owner,
            repo: args.repo,
            number: args.number,
            first: args.first,
            after: args.after,
        }),
    )
    if (res.isErr) {
        if (res.err.type === 'rate-limit-error') {
            return err({ type: 'RATE_LIMIT_ERROR', err: res.err.err })
        }

        return err({ type: 'ERROR', err: octoCatch.gqlErrToString(res) })
    }

    let parsed = zodParse(FetchIssueCommentsResSchema, res.val)
    if (parsed.isErr) {
        return err({ type: 'ERROR', err: parsed.err })
    }

    return ok(parsed.val.repository.issue.comments)
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
                            actor { login ... on User { databaseId } }
                            assignee {
                                ... on User { login databaseId }
                                ... on Mannequin { login databaseId }
                                ... on Organization { login: name databaseId: databaseId }
                                ... on Bot { login databaseId }
                            }
                        }
                        ... on UnassignedEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            assignee {
                                ... on User { login databaseId }
                                ... on Mannequin { login databaseId }
                                ... on Organization { login: name databaseId: databaseId }
                                ... on Bot { login databaseId }
                            }
                        }
                        ... on LabeledEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            label { name color }
                        }
                        ... on UnlabeledEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            label { name color }
                        }
                        ... on MilestonedEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            milestoneTitle
                        }
                        ... on DemilestonedEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            milestoneTitle
                        }
                        ... on ClosedEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                        }
                        ... on ReopenedEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                        }
                        ... on RenamedTitleEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            previousTitle
                            currentTitle
                        }
                        ... on ReferencedEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            commit { oid url }
                        }
                        ... on CrossReferencedEvent {
                            id
                            createdAt
                            actor { login ... on User { databaseId } }
                            source {
                                __typename
                                ... on Issue { number repository { name owner { login } } }
                                ... on PullRequest { number repository { name owner { login } } }
                            }
                        }
                        ... on LockedEvent { id createdAt actor { login ... on User { databaseId } } }
                        ... on UnlockedEvent { id createdAt actor { login ... on User { databaseId } } }
                        ... on PinnedEvent { id createdAt actor { login ... on User { databaseId } } }
                        ... on UnpinnedEvent { id createdAt actor { login ... on User { databaseId } } }
                        ... on TransferredEvent { id createdAt actor { login ... on User { databaseId } } fromRepository { name owner { login } } }
                    }
                }
            }
        }
    }
`

async function fetchIssueTimelineItemsGraphQL(
    octo: Octokit,
    args: { owner: string; repo: string; number: number; first: number; after?: string },
): R<
    z.infer<typeof FetchIssueTimelineItemsResSchema>['repository']['issue']['timelineItems'],
    FetchIssuesErrors
> {
    let res = await octoCatchGql(
        octo.graphql(getIssueTimelineItemsQuery, {
            owner: args.owner,
            repo: args.repo,
            number: args.number,
            first: args.first,
            after: args.after,
        }),
    )
    if (res.isErr) {
        if (res.err.type === 'rate-limit-error') {
            return err({ type: 'RATE_LIMIT_ERROR', err: res.err.err })
        }

        return err({ type: 'ERROR', err: octoCatch.gqlErrToString(res) })
    }

    let parsed = zodParse(FetchIssueTimelineItemsResSchema, res.val)
    if (parsed.isErr) {
        return err({ type: 'ERROR', err: parsed.err })
    }

    return ok(parsed.val.repository.issue.timelineItems)
}

type IssuesPageItem = {
    issue: UpsertDoc<'issues'>
    body: string
    timelineItems: TimelineItemForInsert[]
    comments: CommentForInsert[]
}

function buildIssuesWithCommentsBatch(repoId: Id<'repos'>, fetchedIssues: FetchIssueNode[]) {
    type IssueId = { issueId: number }
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
            logger.error({ repoId, error: parsed.err }, 'invalid issue node, skipping')
            continue
        }
        let issue = parsed.val

        let downloadLabels = O.none<IssueId>()
        if (issue.labels.pageInfo.hasNextPage) {
            downloadLabels = O.some({ issueId: issue.databaseId })
        }

        let downloadAssignees = O.none<IssueId>()
        if (issue.assignees.pageInfo.hasNextPage) {
            downloadAssignees = O.some({ issueId: issue.databaseId })
        }
        let downloadComments = O.none<IssueId>()
        if (issue.comments.pageInfo.hasNextPage) {
            downloadComments = O.some({ issueId: issue.databaseId })
        }

        let downloadTimelineItems = O.none<IssueId>()
        if (issue.timelineItems.pageInfo.hasNextPage) {
            downloadTimelineItems = O.some({ issueId: issue.databaseId })
        }

        let issueDoc = issueNodeToIssueDoc(issue, repoId)
        if (issueDoc.isErr) {
            logger.error(
                { repoId, issueNumber: issue.number, error: issueDoc.err },
                'failed to convert issue node to issue doc',
            )
            continue
        }

        items.push({
            pageItem: {
                issue: issueDoc.val,
                body: issue.body,
                timelineItems: issueNodeToTimelineItemsForInsert(issue, repoId),
                comments: issueNodeToCommentsForInsert(issue, repoId),
            },
            downloadLabels,
            downloadAssignees,
            downloadComments,
            downloadTimelineItems,
        })
    }

    return items
}

type IssueNode = z.infer<typeof IssueNodeSchema>

function issueNodeToIssueDoc(node: IssueNode, repoId: Id<'repos'>): Result<UpsertDoc<'issues'>> {
    let state: 'open' | 'closed' = node.state === 'CLOSED' ? 'closed' : 'open'
    let labels = node.labels.nodes.map((l) => l.name)
    let assignees = node.assignees.nodes.map((a) => a.login)

    let author = gqlGithubUserToDbGithubUser(node.author)

    let doc: UpsertDoc<'issues'> = {
        repoId,
        githubId: node.databaseId,
        number: node.number,
        title: node.title,
        state,
        author,
        labels,
        assignees,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        closedAt: node.closedAt ?? undefined,
        comments: node.comments.nodes.length,
    }

    return ok(doc)
}

function issueNodeToCommentsForInsert(issue: IssueNode, repoId: Id<'repos'>): CommentForInsert[] {
    let comments: CommentForInsert[] = []
    for (let unparsedComment of issue.comments.nodes) {
        let parsed = zodParse(StrictIssueCommentSchema, unparsedComment)
        if (parsed.isErr) {
            logger.error(
                { comment: unparsedComment, error: parsed.err },
                'invalid issue comment, skipping',
            )
            continue
        }
        let c = parsed.val

        let author = gqlGithubUserToDbGithubUser(c.author)

        comments.push({
            githubId: c.databaseId,
            author,
            body: c.body,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            repoId,
        })
    }

    return comments
}

function issueNodeToTimelineItemsForInsert(
    node: IssueNode,
    repoId: Id<'repos'>,
): TimelineItemForInsert[] {
    let timelineItems: TimelineItemForInsert[] = []

    for (let tUnknown of node.timelineItems.nodes) {
        let l = logger.child({ timelineItem: tUnknown, repoId, issueId: node.number })

        let parsed = zodParse(IssueTimelineItemNodeSchema, tUnknown)
        if (parsed.isErr) {
            l.error({ t: tUnknown, error: parsed.err }, 'invalid timeline item, skipping')
            continue
        }
        let t = parsed.val
        let item: TimelineItemForInsert['item']

        if (t.__typename === 'AssignedEvent') {
            item = {
                type: 'assigned',
                assignee: gqlGithubUserToDbGithubUser(t.actor),
            }
        } else if (t.__typename === 'UnassignedEvent') {
            item = {
                type: 'unassigned',
                assignee: gqlGithubUserToDbGithubUser(t.actor),
            }
        } else if (t.__typename === 'LabeledEvent') {
            item = {
                type: 'labeled',
                label: {
                    name: t.label.name,
                    color: t.label.color,
                },
            }
        } else if (t.__typename === 'UnlabeledEvent') {
            item = {
                type: 'unlabeled',
                label: {
                    name: t.label.name,
                    color: t.label.color,
                },
            }
        } else if (t.__typename === 'MilestonedEvent') {
            item = {
                type: 'milestoned',
                milestoneTitle: t.milestoneTitle,
            }
        } else if (t.__typename === 'DemilestonedEvent') {
            item = {
                type: 'demilestoned',
                milestoneTitle: t.milestoneTitle,
            }
        } else if (t.__typename === 'ClosedEvent') {
            item = {
                type: 'closed',
            }
        } else if (t.__typename === 'ReopenedEvent') {
            item = {
                type: 'reopened',
            }
        } else if (t.__typename === 'RenamedTitleEvent') {
            item = {
                type: 'renamed',
                previousTitle: t.previousTitle,
                currentTitle: t.currentTitle,
            }
        } else if (t.__typename === 'ReferencedEvent') {
            item = {
                type: 'referenced',
                commit: {
                    oid: t.commit.oid,
                    url: t.commit.url,
                },
            }
        } else if (t.__typename === 'CrossReferencedEvent') {
            item = {
                type: 'cross_referenced',
                source: {
                    type: t.source.__typename,
                    owner: t.source.repository.owner.login,
                    name: t.source.repository.name,
                    number: t.source.number,
                },
            }
        } else if (t.__typename === 'LockedEvent') {
            item = {
                type: 'locked',
            }
        } else if (t.__typename === 'UnlockedEvent') {
            item = {
                type: 'unlocked',
            }
        } else if (t.__typename === 'PinnedEvent') {
            item = {
                type: 'pinned',
            }
        } else if (t.__typename === 'UnpinnedEvent') {
            item = {
                type: 'unpinned',
            }
        } else if (t.__typename === 'TransferredEvent') {
            item = {
                type: 'transferred',
                fromRepository: {
                    owner: t.fromRepository.owner.login,
                    name: t.fromRepository.name,
                },
            }
        } else {
            t satisfies never
            l.error('unknown timeline item type')
            continue
        }

        if (!t.id) {
            l.error('missing id field for timeline item')
            continue
        }
        if (!t.createdAt) {
            l.error('missing createdAt field for timeline item')
            continue
        }

        let actor
        if (!t.actor || !t.actor.login) {
            actor = null
        } else if (!t.actor.databaseId) {
            actor = 'github-actions' as const
        } else {
            actor = { login: t.actor.login, id: t.actor.databaseId }
        }

        timelineItems.push({
            repoId,
            githubNodeId: t.id,
            createdAt: t.createdAt,
            actor,
            item,
        })
    }

    return timelineItems
}

export function getNextCursor(pageInfo: z.Infer<typeof PageInfoSchema>): O<{ cursor: string }> {
    if (pageInfo.hasNextPage) {
        if (pageInfo.endCursor) {
            return O.some({ cursor: pageInfo.endCursor })
        }
    }

    return O.none()
}
