import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
    ...authTables,

    // pats are personal access tokens for users.
    pats: defineTable({
        userId: v.id('users'),
        token: v.string(),
    }).index('by_user_id', ['userId']),

    repos: defineTable({
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
        head: v.optional(v.id('refs')),
    }).index('by_owner_and_repo', ['owner', 'repo']),

    repoCounts: defineTable({
        repoId: v.id('repos'),
        openIssues: v.number(),
        closedIssues: v.number(),
        openPullRequests: v.number(),
        closedPullRequests: v.number(),
    }).index('by_repoId', ['repoId']),

    installations: defineTable({
        userId: v.id('users'),
        suspended: v.boolean(),
        repoId: v.id('repos'),
        installationId: v.string(), // GitHub installation ID
    })
        .index('by_userId', ['userId'])
        .index('by_repoId', ['repoId'])
        .index('by_installationId', ['installationId']),

    installationAccessTokens: defineTable({
        repoId: v.id('repos'),
        token: v.string(),
        expiresAt: v.string(),
    }).index('by_repo_id', ['repoId']),

    // commits saves the sha for each commit.
    commits: defineTable({
        repo: v.id('repos'),
        sha: v.string(),
    }).index('by_repo_and_sha', ['repo', 'sha']),

    refs: defineTable({
        repo: v.id('repos'),
        commit: v.id('commits'),
        ref: v.string(),
        isTag: v.boolean(),
    }).index('by_repo_and_commit', ['repo', 'commit']),

    // filenames contains all the filenames for each repo. The size of each row
    // can be potentially very different across repositories.
    filenames: defineTable({
        commit: v.id('commits'),
        files: v.array(v.string()),
    }).index('by_commit', ['commit']),

    files: defineTable({
        repo: v.id('repos'),
        commit: v.id('commits'),
        filename: v.string(),
        content: v.string(),
    }).index('by_repo_and_commit', ['repo', 'commit']),

    issues: defineTable({
        repo: v.id('repos'),
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
    })
        .searchIndex('search_issues', {
            searchField: 'title',
            filterFields: ['repo'],
        })
        .index('by_repo_and_number', ['repo', 'number'])
        .index('by_github_id', ['githubId']),

    issueComments: defineTable({
        issueId: v.id('issues'),
        githubId: v.number(), // GitHub comment id
        author: v.object({
            login: v.string(),
            id: v.number(),
        }),
        body: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
        reactions: v.optional(
            v.array(
                v.object({
                    user: v.object({
                        login: v.string(),
                        id: v.number(),
                    }),
                    content: v.string(), // e.g., '+1', 'heart', etc.
                }),
            ),
        ),
        isDeleted: v.optional(v.boolean()),
    })
        .index('by_issue', ['issueId'])
        .index('by_github_id', ['githubId']),
})
