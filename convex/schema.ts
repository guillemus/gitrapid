import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
    repos: defineTable({
        owner: v.string(),
        repo: v.string(),
    }),
    commits: defineTable({
        repo: v.id('repos'),
        sha: v.string(),
    }).index('by_repo_and_sha', ['repo', 'sha']),
    refs: defineTable({
        repo: v.id('repos'),
        commit: v.id('commits'),
        ref: v.string(),
    }).index('by_commit_and_repo', ['commit', 'repo']),
    filenames: defineTable({
        commit: v.id('commits'),
        name: v.string(),
    }).index('by_commit', ['commit']),
})
