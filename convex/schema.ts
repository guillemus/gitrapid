import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const reposSchema = {
    owner: v.string(),
    repo: v.string(),
    private: v.boolean(),
    headId: v.optional(v.id('refs')),
}

const repos = defineTable(reposSchema).index('by_owner_and_repo', ['owner', 'repo'])

export const userReposSchema = {
    userId: v.id('users'),
    repoId: v.id('repos'),
}

const userRepos = defineTable(userReposSchema).index('by_userId_repoId', ['userId', 'repoId'])

export const repoCountsSchema = {
    repoId: v.id('repos'),
    openIssues: v.number(),
    closedIssues: v.number(),
    openPullRequests: v.number(),
    closedPullRequests: v.number(),
}

const repoCounts = defineTable(repoCountsSchema).index('by_repoId', ['repoId'])

export const repoDownloadsSchema = {
    repoId: v.id('repos'),
    status: v.union(
        // There's no initial state really. We assume that if the repoDownload row isn't there
        // the download hasn't started.

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

    syncedSince: v.optional(v.string()),
}

const repoDownloads = defineTable(repoDownloadsSchema).index('by_repoId', ['repoId'])

export const refsSchema = {
    repoId: v.id('repos'),
    name: v.string(), // e.g., "refs/heads/main" or "refs/tags/v1.0.0"
    commitSha: v.string(),
    isTag: v.optional(v.boolean()), // true for tags, false/undefined for branches
}
const refs = defineTable(refsSchema)
    .index('by_repo_and_name', ['repoId', 'name'])
    .index('by_repo_and_commit', ['repoId', 'commitSha'])

// naming comes from github itself
const gitUser = v.object({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    date: v.optional(v.string()),
})

export const commitsSchema = {
    repoId: v.id('repos'),
    treeSha: v.string(),
    sha: v.string(),
    parentShas: v.array(v.string()),
    message: v.string(),
    author: v.optional(gitUser),
    committer: v.optional(gitUser),
}
const commits = defineTable(commitsSchema).index('by_repo_and_sha', ['repoId', 'sha'])

export const treesSchema = {
    repoId: v.id('repos'),
    sha: v.string(), // Tree SHA (content hash)
}
const trees = defineTable(treesSchema).index('by_repo_and_sha', ['repoId', 'sha'])

export const treeEntriesSchema = {
    repoId: v.id('repos'),
    rootTreeSha: v.string(),
    entrySha: v.string(), // Blob or tree sha
    path: v.string(),
    mode: v.string(),
    entryType: v.union(v.literal('blob'), v.literal('tree')),
}
const treeEntries = defineTable(treeEntriesSchema).index('by_repo_tree_and_path', [
    'repoId',
    'rootTreeSha',
    'path',
])

export const blobsSchema = {
    repoId: v.id('repos'),
    sha: v.string(), // Blob SHA (content hash)
    content: v.string(), // Base64 or utf-8
    encoding: v.string(), // 'base64' | 'utf-8'
    size: v.number(),
}
const blobs = defineTable(blobsSchema).index('by_repo_and_sha', ['repoId', 'sha'])

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
        filterFields: ['repoId'],
    })
    .index('by_repo_and_number', ['repoId', 'number'])
    .index('by_github_id', ['githubId'])

export const issueBodiesSchema = {
    issueId: v.id('issues'),
    body: v.string(),
}

const issueBodies = defineTable(issueBodiesSchema).index('by_issue_id', ['issueId'])

export const issueCommentsSchema = {
    issueId: v.id('issues'),
    githubId: v.number(), // GitHub comment id
    author: v.object({ login: v.string(), id: v.number() }),
    body: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    reactions: v.optional(
        v.array(
            v.object({
                user: v.object({ login: v.string(), id: v.number() }),
                content: v.string(), // e.g., '+1', 'heart', etc.
            }),
        ),
    ),
    isDeleted: v.optional(v.boolean()),
}

const issueComments = defineTable(issueCommentsSchema)
    .index('by_issue', ['issueId'])
    .index('by_github_id', ['githubId'])

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
    repoCounts,
    repoDownloads,
    userRepos,

    blobs,
    trees,
    treeEntries,
    commits,
    refs,

    issues,
    issueBodies,
    issueComments,

    pats,
})
