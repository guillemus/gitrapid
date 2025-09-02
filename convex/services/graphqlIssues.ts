import type { Octokit } from 'octokit'
import { ok, tryCatch, wrap } from '../shared'

export type IssueCommentNode = {
    databaseId: number | null
    author: { login: string | null; databaseId: number | null } | null
    body: string | null
    createdAt: string
    updatedAt: string
}

// GraphQL timeline item types (discriminated by __typename)
export type GqlActor = { login: string | null; databaseId?: number | null }
export type GqlAssignee = { login: string | null; databaseId: number | null }
export type GqlLabel = { name: string; color: string }
export type GqlCommit = { oid: string; url: string }
export type GqlRepoRef = { name: string; owner: { login: string } }
export type GqlCrossRefSource =
    | { __typename: 'Issue'; number: number; repository: GqlRepoRef }
    | { __typename: 'PullRequest'; number: number; repository: GqlRepoRef }

export type IssueTimelineItemNode =
    | {
          __typename: 'AssignedEvent'
          id: string
          createdAt: string
          actor: GqlActor
          assignee: GqlAssignee
      }
    | {
          __typename: 'UnassignedEvent'
          id: string
          createdAt: string
          actor: GqlActor
          assignee: GqlAssignee
      }
    | {
          __typename: 'LabeledEvent'
          id: string
          createdAt: string
          actor: GqlActor
          label: GqlLabel
      }
    | {
          __typename: 'UnlabeledEvent'
          id: string
          createdAt: string
          actor: GqlActor
          label: GqlLabel
      }
    | {
          __typename: 'MilestonedEvent'
          id: string
          createdAt: string
          actor: GqlActor
          milestoneTitle: string
      }
    | {
          __typename: 'DemilestonedEvent'
          id: string
          createdAt: string
          actor: GqlActor
          milestoneTitle: string
      }
    | {
          __typename: 'ClosedEvent'
          id: string
          createdAt: string
          actor: GqlActor
      }
    | {
          __typename: 'ReopenedEvent'
          id: string
          createdAt: string
          actor: GqlActor
      }
    | {
          __typename: 'ReferencedEvent'
          id: string
          createdAt: string
          actor: GqlActor
          commit: GqlCommit
      }
    | {
          __typename: 'CrossReferencedEvent'
          id: string
          createdAt: string
          actor: GqlActor
          source: GqlCrossRefSource
      }
    | {
          __typename: 'LockedEvent'
          id: string
          createdAt: string
          actor: GqlActor
      }
    | {
          __typename: 'UnlockedEvent'
          id: string
          createdAt: string
          actor: GqlActor
      }
    | {
          __typename: 'PinnedEvent'
          id: string
          createdAt: string
          actor: GqlActor
      }
    | {
          __typename: 'UnpinnedEvent'
          id: string
          createdAt: string
          actor: GqlActor
      }
    | {
          __typename: 'TransferredEvent'
          id: string
          createdAt: string
          actor: GqlActor
          fromRepository: GqlRepoRef
          toRepository: GqlRepoRef
      }

export type IssueNode = {
    databaseId: number | null
    number: number
    title: string
    state: 'OPEN' | 'CLOSED'
    body: string | null
    createdAt: string
    updatedAt: string
    closedAt: string | null
    author: { login: string | null; databaseId: number | null } | null
    labels: { nodes: { name: string | null }[] }
    assignees: { nodes: { login: string | null }[] }
    comments: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: IssueCommentNode[]
    }
    timelineItems?: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: Array<IssueTimelineItemNode>
    }
}

export type IssuesPage = {
    nodes: IssueNode[]
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export type IssueCommentsPage = {
    nodes: IssueCommentNode[]
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

type IssuesGraphQLResponse = {
    repository: {
        issues: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null }
            nodes: IssueNode[]
        }
    } | null
}

type IssueCommentsGraphQLResponse = {
    repository: {
        issue: {
            comments: {
                pageInfo: { hasNextPage: boolean; endCursor: string | null }
                nodes: IssueCommentNode[]
            }
        } | null
    } | null
}

export async function fetchIssuesPageGraphQL(
    octo: Octokit,
    args: { owner: string; repo: string; after?: string; since?: string },
): R<IssuesPage> {
    let query = `
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
                labels(first: 10) { nodes { name } }
                assignees(first: 10) { nodes { login } }
                comments(first: 100) {
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
                  first: 100,
                  itemTypes: [
                    ASSIGNED_EVENT,
                    UNASSIGNED_EVENT,
                    LABELED_EVENT,
                    UNLABELED_EVENT,
                    MILESTONED_EVENT,
                    DEMILESTONED_EVENT,
                    CLOSED_EVENT,
                    REOPENED_EVENT,
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
                    ... on UniformResourceLocatable { id }
                    ... on Actor { }
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
                      toRepository { name owner { login } }
                    }
                  }
                }
              }
            }
          }
        }
    `

    let res = await tryCatch(
        octo.graphql<IssuesGraphQLResponse>(query, {
            owner: args.owner,
            repo: args.repo,
            first: 100,
            after: args.after,
            since: args.since ?? null,
        }),
    )
    if (res.isErr) {
        return wrap('failed to fetch issues via GraphQL', res)
    }

    let repo = res.val.repository
    let issues = repo?.issues ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }

    return ok({ nodes: issues.nodes, pageInfo: issues.pageInfo })
}

export async function fetchIssueCommentsGraphQL(
    octo: Octokit,
    args: { owner: string; repo: string; issueNumber: number; after?: string },
): R<IssueCommentsPage> {
    let query = `
        query GetIssueComments($owner: String!, $repo: String!, $issueNumber: Int!, $after: String) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
              comments(first: 100, after: $after) {
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

    let res = await tryCatch(
        octo.graphql<IssueCommentsGraphQLResponse>(query, {
            owner: args.owner,
            repo: args.repo,
            issueNumber: args.issueNumber,
            after: args.after,
        }),
    )
    if (res.isErr) return wrap('failed to fetch issue comments via GraphQL', res)

    let comments = res.val.repository?.issue?.comments ?? {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
    }

    return ok({ nodes: comments.nodes, pageInfo: comments.pageInfo })
}
