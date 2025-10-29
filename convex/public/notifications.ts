import type { Doc, Id } from '@convex/_generated/dataModel'
import type { QueryCtx } from '@convex/_generated/server'
import { Notifications } from '@convex/models/notifications'
import { Repos } from '@convex/models/repos'
import { assertNever } from '@convex/shared'
import { publicMutation, publicQuery, type FnArgs } from '@convex/utils'
import { assert, asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const allRepos = publicQuery(async (ctx) => {
    return Notifications.distinctRepos(ctx, ctx.userId)
})

export const listPinned = publicQuery(async (ctx) => {
    let pinned
    pinned = await ctx.db
        .query('notifications')
        .withIndex('by_userId_pinned', (q) => q.eq('userId', ctx.userId).eq('pinned', true))
        .order('desc')
        .collect()

    pinned = await asyncMap(pinned, async (notification) => {
        let repo = await ctx.db.get(notification.repoId)
        assert(repo)

        return {
            ...notification,
            repo: repo,
        }
    })

    return pinned
})

let listArgs = {
    q: v.optional(v.string()),
    tab: v.optional(
        v.union(v.literal('saved'), v.literal('done'), v.literal('unread'), v.literal('all')),
    ),
    repo: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
}

async function applyFilters(
    ctx: QueryCtx,
    userId: Id<'users'>,
    args: FnArgs<{ args: typeof listArgs }>,
) {
    let query
    query = ctx.db.query('notifications')

    let repoId: Id<'repos'> | undefined
    if (args.repo) {
        let [owner, repo] = args.repo.split('/')
        if (!owner || !repo) {
            throw new Error(`Invalid owner/repo format, given ${args.repo}`)
        }

        let savedRepo = await Repos.getByOwnerAndRepo.handler(ctx, { owner, repo })
        assert(savedRepo, `Repo not found: ${owner}/${repo}`)

        repoId = savedRepo._id
    }

    if (args.q) {
        let search = args.q

        query = query.withSearchIndex('search_notifications', (q) => {
            let x
            x = q.search('title', search)

            if (repoId) {
                x = x.eq('repoId', repoId)
            }

            if (args.tab === 'done') {
                x = x.eq('done', true)
            } else if (args.tab === 'saved') {
                x = x.eq('saved', true)
            } else if (args.tab === 'unread') {
                x = x.eq('unread', true)
            }

            return x
        })

        query = await query.paginate(args.paginationOpts)
    } else {
        if (args.tab === 'all' || args.tab === undefined) {
            query = query.withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
        } else if (args.tab === 'saved') {
            query = query.withIndex('by_userId_saved', (q) =>
                q.eq('userId', userId).eq('saved', true),
            )
        } else if (args.tab === 'done') {
            query = query.withIndex('by_userId_done', (q) =>
                q.eq('userId', userId).eq('done', true),
            )
        } else if (args.tab === 'unread') {
            query = query.withIndex('by_userId_unread', (q) =>
                q.eq('userId', userId).eq('unread', true),
            )
        } else assertNever(args.tab)

        if (repoId) {
            query = query.filter((x) => x.eq(x.field('repoId'), repoId))
        }

        query = query.order('desc')
        query = await query.paginate(args.paginationOpts)
    }

    let mapped = await asyncMap(query.page, async (notification) => {
        let repo = await ctx.db.get(notification.repoId)
        assert(repo)

        return {
            ...notification,
            repo: repo,
        }
    })

    return mapped
}

export const list = publicQuery({
    args: listArgs,
    async handler(ctx, args) {
        let filtered = await applyFilters(ctx, ctx.userId, args)

        return filtered
    },
})

export const updateNotification = publicMutation({
    args: {
        id: v.id('notifications'),
        updates: v.object({
            unread: v.optional(v.boolean()),
            saved: v.optional(v.boolean()),
            pinned: v.optional(v.boolean()),
            done: v.optional(v.boolean()),
        }),
    },
    async handler(ctx, args) {
        let notification = await ctx.db.get(args.id)
        assert(
            notification && ctx.userId === notification?.userId,
            'You are not allowed to update this notification',
        )

        if (args.updates.unread !== undefined) {
            notification.unread = args.updates.unread
        }
        if (args.updates.saved !== undefined) {
            notification.saved = args.updates.saved
        }
        if (args.updates.pinned !== undefined) {
            notification.pinned = args.updates.pinned
        }
        if (args.updates.done !== undefined) {
            notification.done = args.updates.done
        }

        await ctx.db.patch(args.id, notification)
    },
})
