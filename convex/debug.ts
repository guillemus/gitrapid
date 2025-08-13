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

export const listInstallations = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('installations').collect(),
})

export const listCommits = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('commits').collect(),
})

export const listRepos = protectedQuery({
    args: {},
    handler: (ctx) => ctx.db.query('repos').collect(),
})
