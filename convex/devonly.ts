import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { query } from './_generated/server'
import { appEnv } from './env'

const VALID_TABLE_NAMES = [
    'repos',
    'userRepos',
    'githubUsers',
    'issues',
    'issueLabels',
    'issueAssignees',
    'issueBodies',
    'issueComments',
    'issueTimelineItems',
    'labels',
    'pats',
    'notifications',
    'userWorkflows',
    'repoWorkflows',
    'users',
] as const

type ValidTableName = (typeof VALID_TABLE_NAMES)[number]

function isValidTableName(table: unknown): table is ValidTableName {
    return typeof table === 'string' && VALID_TABLE_NAMES.includes(table as ValidTableName)
}

export const listTable = query({
    args: {
        table: v.string(),
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        if (!appEnv.DEV) throw new Error('dev only')

        if (!isValidTableName(args.table)) {
            throw new Error(`Invalid table name: ${args.table}`)
        }

        return ctx.db.query(args.table).paginate(args.paginationOpts)
    },
})
