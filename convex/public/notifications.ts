import { Notifications } from '@convex/models/notifications'
import { Repos } from '@convex/models/repos'
import { publicQuery } from '@convex/utils'
import { assert } from 'convex-helpers'
import { asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const allRepos = publicQuery(async (ctx) => {
    return Notifications.distinctRepos(ctx, ctx.userId)
})

export const list = publicQuery({
    args: {
        tab: v.optional(
            v.union(v.literal('saved'), v.literal('done'), v.literal('unread'), v.literal('all')),
        ),
        repo: v.optional(v.string()),
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let pinned
        {
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
        }

        let filtered
        {
            if (args.repo) {
                let [owner, repo] = args.repo.split('/')
                if (!owner || !repo) {
                    throw new Error(`Invalid owner/repo format, given ${args.repo}`)
                }

                let savedRepo = await Repos.getByOwnerAndRepo.handler(ctx, { owner, repo })
                if (!savedRepo) {
                    throw new Error(`Repo not found: ${owner}/${repo}`)
                }

                let repoId = savedRepo._id
            }
        }

        return { pinned }
    },
})

export const list_ = publicQuery({
    args: {
        tab: v.optional(
            v.union(v.literal('saved'), v.literal('done'), v.literal('unread'), v.literal('all')),
        ),
        repo: v.optional(v.string()),
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let page

        if (args.repo) {
            let [owner, repo] = args.repo.split('/')
            if (!owner || !repo) {
                throw new Error(`Invalid owner/repo format, given ${args.repo}`)
            }

            let savedRepo = await Repos.getByOwnerAndRepo.handler(ctx, { owner, repo })
            if (!savedRepo) {
                throw new Error(`Repo not found: ${owner}/${repo}`)
            }

            let repoId = savedRepo._id

            page = await ctx.db
                .query('notifications')
                .withIndex('by_userId_repoId_updatedAt', (x) =>
                    x.eq('userId', ctx.userId).eq('repoId', repoId),
                )
                .order('desc')
                .paginate(args.paginationOpts)
        } else {
            page = await ctx.db
                .query('notifications')
                .withIndex('by_userId_updatedAt', (q) => q.eq('userId', ctx.userId))
                .order('desc')
                .paginate(args.paginationOpts)
        }

        let mapped
        mapped = await asyncMap(page.page, async (notification) => {
            let repo = await ctx.db.get(notification.repoId)
            if (!repo) return null

            return {
                ...notification,
                repo: repo,
            }
        })
        mapped = mapped.filter((x) => x !== null)

        return {
            ...page,
            page: mapped,
        }
    },
})
