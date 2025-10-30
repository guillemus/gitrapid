import type { Id } from '@convex/_generated/dataModel'
import type { QueryCtx } from '@convex/_generated/server'
import { Notifications } from '@convex/models/notifications'
import { Repos } from '@convex/models/repos'
import { assertNever } from '@convex/shared'
import { publicMutation, publicQuery, type FnArgs } from '@convex/utils'
import { assert, asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const allRepos = publicQuery({
    args: {
        tab: v.optional(
            v.union(v.literal('saved'), v.literal('done'), v.literal('unread'), v.literal('all')),
        ),
    },
    async handler(ctx, args) {
        let repos = await Notifications.distinctRepos(ctx, ctx.userId)

        let reposWithCounts = await asyncMap(repos, async (repo) => {
            let query = buildQueryForTab(ctx, ctx.userId, repo._id, args.tab)
            let notifications = await query.take(51)

            return {
                ...repo,
                count: notifications.length,
            }
        })

        return reposWithCounts
    },
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

type TabType = 'saved' | 'done' | 'unread' | 'all' | undefined

function buildQueryForTab(
    ctx: QueryCtx,
    userId: Id<'users'>,
    repoId: Id<'repos'> | undefined,
    tab: TabType,
) {
    let query
    if (tab === 'all' || tab === undefined) {
        query = ctx.db
            .query('notifications')
            .withIndex('by_userId_done', (q) => q.eq('userId', userId).eq('done', false))
    } else if (tab === 'saved') {
        query = ctx.db
            .query('notifications')
            .withIndex('by_userId_saved', (q) => q.eq('userId', userId).eq('saved', true))
    } else if (tab === 'done') {
        query = ctx.db
            .query('notifications')
            .withIndex('by_userId_done', (q) => q.eq('userId', userId).eq('done', true))
    } else if (tab === 'unread') {
        query = ctx.db
            .query('notifications')
            .withIndex('by_userId_unread', (q) => q.eq('userId', userId).eq('unread', true))
    } else {
        assertNever(tab)
        query = ctx.db
            .query('notifications')
            .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
    }

    if (repoId) {
        query = query.filter((x) => x.eq(x.field('repoId'), repoId))
    }

    return query.order('desc')
}

async function applyFilters(
    ctx: QueryCtx,
    userId: Id<'users'>,
    args: FnArgs<{ args: typeof listArgs }>,
) {
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

    let paginationResult
    if (args.q) {
        let search = args.q

        let query = ctx.db.query('notifications').withSearchIndex('search_notifications', (q) => {
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
            } else {
                // inbox: show only notifications that are not done
                x = x.eq('done', false)
            }

            return x
        })

        paginationResult = await query.paginate(args.paginationOpts)
    } else {
        let query = buildQueryForTab(ctx, userId, repoId, args.tab)
        paginationResult = await query.paginate(args.paginationOpts)
    }

    let mapped = await asyncMap(paginationResult.page, async (notification) => {
        let repo = await ctx.db.get(notification.repoId)
        assert(repo)

        return {
            ...notification,
            repo: repo,
        }
    })

    return {
        page: mapped,
        isDone: paginationResult.isDone,
        continueCursor: paginationResult.continueCursor,
    }
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

export const updateBatch = publicMutation({
    args: {
        all: v.boolean(),
        selected: v.array(v.id('notifications')),

        updates: v.object({
            unread: v.optional(v.boolean()),
            saved: v.optional(v.boolean()),
            pinned: v.optional(v.boolean()),
            done: v.optional(v.boolean()),
        }),
    },
    async handler(ctx, args) {
        if (args.all) {
            let allNotifications = await ctx.db
                .query('notifications')
                .withIndex('by_userId_done', (q) => q.eq('userId', ctx.userId))
                .take(1000)

            for (let notification of allNotifications) {
                await ctx.db.patch(notification._id, args.updates)
            }
        } else {
            for (let id of args.selected) {
                await ctx.db.patch(id, args.updates)
            }
        }
    },
})
