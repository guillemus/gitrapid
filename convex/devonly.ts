// Queries here are meant to be used for debugging only

import { devQuery } from './utils'

export const listRefs = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('refs').collect(),
})

export const listUsers = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('users').collect(),
})

export const listAccounts = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('authAccounts').collect(),
})

export const listPATs = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('pats').collect(),
})

export const listCommits = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('commits').collect(),
})

export const listRepos = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('repos').collect(),
})

export const listUserRepos = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('userRepos').collect(),
})

export const listRepoCounts = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('repoCounts').collect(),
})

export const listRepoDownloads = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('repoDownloads').collect(),
})

export const listBlobs = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('blobs').collect(),
})

export const listTrees = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('trees').collect(),
})

export const listTreeEntries = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('treeEntries').collect(),
})

export const listIssues = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('issues').collect(),
})

export const listIssueComments = devQuery({
    args: {},
    handler: (ctx) => ctx.db.query('issueComments').collect(),
})
