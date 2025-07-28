import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export default defineSchema({
    ...authTables,

    repos: defineTable({
        owner: v.string(),
        repo: v.string(),
        head: v.optional(v.id('commits')),
    }),

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

    // appRateLimit is used to track the rate limit of the app.
    appRateLimit: defineTable({
        limit: v.number(),
        used: v.number(),
        remaining: v.number(),
        reset: v.string(),
    }),
})
