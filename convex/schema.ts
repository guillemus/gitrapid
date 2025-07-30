import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export default defineSchema({
    ...authTables,

    usersData: defineTable({
        userId: v.id('users'),
    }).index('by_userId', ['userId']),

    repos: defineTable({
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
        head: v.optional(v.id('commits')),
    }),

    installations: defineTable({
        userDataId: v.id('usersData'),
        suspended: v.boolean(),
        repoId: v.id('repos'),
        installationId: v.string(), // GitHub installation ID
    })
        .index('by_userDataId', ['userDataId'])
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

    // refs are dynamic pointers to commits. When the user selects a ref, this
    // will be 'dereferenced' back to a pointer, which will get all the files.
    // This table is also useful to separate filename from ref when parsing a github path.
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
        state: v.string(), // "open" | "closed"
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
