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

export const repoCountsSchema = {
    repoId: v.id('repos'),
    openIssues: v.number(),
    closedIssues: v.number(),
    openPullRequests: v.number(),
    closedPullRequests: v.number(),
}

const repoCounts = defineTable(repoCountsSchema).index('by_repoId', ['repoId'])

export const repoDownloadStatusSchema = {
    repoId: v.id('repos'),
    status: v.union(
        v.literal('initial'),
        v.literal('pending'),
        v.literal('success'),
        v.literal('error'),
    ),
    message: v.optional(v.string()),
}

const repoDownloadStatus = defineTable(repoDownloadStatusSchema).index('by_repoId', ['repoId'])

export const refsSchema = {
    repoId: v.id('repos'),
    name: v.string(), // e.g., "refs/heads/main" or "refs/tags/v1.0.0"
    commitSha: v.string(),
    isTag: v.optional(v.boolean()), // true for tags, false/undefined for branches
}
const refs = defineTable(refsSchema)
    .index('by_repo_and_name', ['repoId', 'name'])
    .index('by_repo_and_commit', ['repoId', 'commitSha'])

const githubPerson = v.object({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    date: v.optional(v.string()),
})

export const commitsSchema = {
    repoId: v.id('repos'),
    treeSha: v.string(),
    sha: v.string(),
    message: v.string(),
    author: v.optional(githubPerson),
    committer: v.optional(githubPerson),
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
    body: v.optional(v.string()),
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

export const syncStatesSchema = {
    repoId: v.id('repos'),
    repoMetaEtag: v.optional(v.string()),
    refsEtagHeads: v.optional(v.string()),
    refsEtagTags: v.optional(v.string()),
    issuesSince: v.optional(v.string()),
    commentsSince: v.optional(v.string()),
    backfillDone: v.optional(v.boolean()),
    lastSuccessAt: v.optional(v.string()),
    syncError: v.optional(v.string()),
}

const syncStates = defineTable(syncStatesSchema).index('by_repoId', ['repoId'])

export const installationsSchema = {
    repoId: v.id('repos'),
    userId: v.id('users'),
    suspended: v.boolean(),
    githubInstallationId: v.number(),
}

const installations = defineTable(installationsSchema)
    .index('by_userId_repoId', ['userId', 'repoId'])
    .index('by_githubInstallationId', ['githubInstallationId'])

export const installationAccessTokensSchema = {
    installationId: v.id('installations'),
    token: v.string(),
    expiresAt: v.string(),
}

const installationAccessTokens = defineTable(installationAccessTokensSchema).index(
    'by_installationId',
    ['installationId'],
)

export const patsSchema = {
    userId: v.id('users'),
    token: v.string(),
}

const pats = defineTable(patsSchema).index('by_user_id', ['userId'])

export default defineSchema({
    ...authTables,

    repos,
    repoCounts,
    repoDownloadStatus,
    syncStates,

    blobs,
    trees,
    treeEntries,
    commits,
    refs,

    issues,
    issueComments,

    pats,
    installations,
    installationAccessTokens,
})
