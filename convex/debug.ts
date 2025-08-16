// Queries here are meant to be used for debugging only

import { protectedQuery } from './utils'

export const listRefs = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('refs').collect(),
})

export const listUsers = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('users').collect(),
})

export const listAccounts = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('authAccounts').collect(),
})

export const listPATs = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('pats').collect(),
})

export const listCommits = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('commits').collect(),
})

export const listRepos = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('repos').collect(),
})

export const listUserRepos = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('userRepos').collect(),
})

export const listRepoCounts = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('repoCounts').collect(),
})

export const listRepoDownloadStatus = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('repoDownloadStatus').collect(),
})

export const listBlobs = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('blobs').collect(),
})

export const listTrees = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('trees').collect(),
})

export const listTreeEntries = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('treeEntries').collect(),
})

export const listIssues = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('issues').collect(),
})

export const listIssueComments = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('issueComments').collect(),
})
