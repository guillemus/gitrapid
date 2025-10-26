import { Notifications } from '@convex/models/notifications'
import { publicQuery } from '@convex/utils'
import { asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'

export const allRepos = publicQuery(async (ctx) => {
    return Notifications.distinctRepos(ctx, ctx.userId)
})

export const list = publicQuery({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let page = await ctx.db
            .query('notifications')
            .withIndex('by_userId_updatedAt', (q) => q.eq('userId', ctx.userId))
            .order('desc')
            .paginate(args.paginationOpts)

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

// mark as read
// mark as read
