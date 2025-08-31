import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const reposSchema = {
    owner: v.string(),
    repo: v.string(),
    private: v.boolean(),

    download: v.object({
        status: v.union(
            // There's no initial state really. We assume that if the repoDownload row isn't there
            // the download hasn't started.

            // When inserting a new row to repos, initial is the default state.
            v.literal('initial'),
            // Represents when the repository is being downloaded for the first time.
            v.literal('backfilling'),
            // Represents when the repository is being synced. It has already been downloaded
            v.literal('syncing'),
            // Repository is ready to be used fully
            v.literal('success'),
            // Error happened to download. We should explain at message what happened exactly.
            v.literal('error'),
            // Download was cancelled, either internally or externally
            v.literal('cancelled'),
        ),
        message: v.optional(v.string()),
        lastSyncedAt: v.optional(v.string()),
    }),

    openIssues: v.number(),
    closedIssues: v.number(),
    openPullRequests: v.number(),
    closedPullRequests: v.number(),
}

const repos = defineTable(reposSchema).index('by_owner_and_repo', ['owner', 'repo'])

export const userReposSchema = {
    userId: v.id('users'),
    repoId: v.id('repos'),
}

const userRepos = defineTable(userReposSchema).index('by_userId_repoId', ['userId', 'repoId'])

export const issuesSchema = {
    repoId: v.id('repos'),
    githubId: v.number(),
    number: v.number(), // Issue number in the repo
    title: v.string(),
    state: v.union(v.literal('open'), v.literal('closed')),
    author: v.object({
        login: v.string(),
        id: v.number(),
    }),
    labels: v.optional(v.array(v.string())),
    assignees: v.optional(v.array(v.string())), // logins or ids
    createdAt: v.string(),
    updatedAt: v.string(),
    closedAt: v.optional(v.string()),
    comments: v.optional(v.number()),
}

const issues = defineTable(issuesSchema)
    .searchIndex('search_issues', {
        searchField: 'title',
        filterFields: ['repoId', 'state'],
    })
    .index('by_repo_and_number', ['repoId', 'number'])
    .index('by_github_id', ['githubId'])
    .index('by_repo_state_number', ['repoId', 'state', 'number'])
    .index('by_repo_createdAt', ['repoId', 'createdAt'])
    .index('by_repo_updatedAt', ['repoId', 'updatedAt'])
    .index('by_repo_comments', ['repoId', 'comments'])
    .index('by_repo_state_createdAt', ['repoId', 'state', 'createdAt'])
    .index('by_repo_state_updatedAt', ['repoId', 'state', 'updatedAt'])
    .index('by_repo_state_comments', ['repoId', 'state', 'comments'])

export const issueBodiesSchema = {
    repoId: v.id('repos'),
    issueId: v.id('issues'),
    body: v.string(),
}

const issueBodies = defineTable(issueBodiesSchema)
    .index('by_issue_id', ['issueId'])
    .searchIndex('search_issue_bodies', {
        searchField: 'body',
        filterFields: ['repoId'],
    })

export const issuesCommentsWithoutIssueIdSchema = {
    githubId: v.number(),
    author: v.object({ login: v.string(), id: v.number() }),
    body: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    reactions: v.optional(
        v.array(
            v.object({
                user: v.object({ login: v.string(), id: v.number() }),
                content: v.string(),
            }),
        ),
    ),
    isDeleted: v.optional(v.boolean()),
}

export const issueCommentsSchema = {
    repoId: v.id('repos'),
    issueId: v.id('issues'),
    ...issuesCommentsWithoutIssueIdSchema,
}

const issueComments = defineTable(issueCommentsSchema)
    .index('by_issue', ['issueId'])
    .searchIndex('search_issue_comments', {
        searchField: 'body',
        filterFields: ['repoId'],
    })

export const scopesSchema = v.array(
    v.union(v.literal('public_repo'), v.literal('repo'), v.literal('notifications')),
)

export const patsSchema = {
    userId: v.id('users'),
    token: v.string(),
    scopes: scopesSchema,
    expiresAt: v.string(),

    rateLimit: v.optional(
        v.object({
            limit: v.optional(v.string()),
            remaining: v.optional(v.string()),
            reset: v.optional(v.string()),
        }),
    ),
}

const pats = defineTable(patsSchema).index('by_user_id', ['userId'])

export default defineSchema({
    ...authTables,

    repos,
    userRepos,

    issues,
    issueBodies,
    issueComments,

    pats,
})
