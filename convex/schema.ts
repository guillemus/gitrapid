import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
    repos: defineTable({
        owner: v.string(),
        repo: v.string(),
    }),

    // commits saves the sha for each commit.
    commits: defineTable({
        repo: v.id('repos'),
        sha: v.string(),
    })
        .index('by_repo_and_sha', ['repo', 'sha'])
        .index('by_repo', ['repo']),

    // refs are dynamic pointers to commits. When the user selects a ref, this
    // will be 'dereferenced' back to a pointer, which will get all the files.
    // This table is also useful to separate filename from ref when parsing a github path.
    refs: defineTable({
        repo: v.id('repos'),
        commit: v.id('commits'),
        ref: v.string(),
    }).index('by_commit_and_repo', ['commit', 'repo']),

    // commitFiles saves which commits have files. When updating repository refs,
    // new commits might be saved, so a commit might be in a temporary state of
    // not having any files.
    commitFiles: defineTable({
        commit: v.id('commits'),
    }).index('by_commit', ['commit']),

    // filenames contains all the filenames for each repo. The size of each row
    // can be potentially very different across repositories.
    filenames: defineTable({
        commitFileId: v.id('commitFiles'),
        files: v.array(v.string()),
    }).index('by_commit_file', ['commitFileId']),
})
