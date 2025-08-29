import type { Octokit } from 'octokit'
import { ok, tryCatch, wrap } from '../shared'

export type IssueCommentNode = {
    databaseId: number | null
    author: { login: string | null; databaseId: number | null } | null
    body: string | null
    createdAt: string
    updatedAt: string
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
            issues(first: $first, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}, states: [OPEN, CLOSED], filterBy: { since: $since }) {
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
    if (res.isErr) return wrap('failed to fetch issues via GraphQL', res)

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
