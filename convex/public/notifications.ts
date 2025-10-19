import { query } from '@convex/_generated/server'
import { Auth } from '@convex/services/auth'
import { asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'

export const list = query({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)

        let page = await ctx.db
            .query('notifications')
            .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
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
