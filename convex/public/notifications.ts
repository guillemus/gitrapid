import { query } from '@convex/_generated/server'
import { Auth } from '@convex/services/auth'
import { paginationOptsValidator } from 'convex/server'

export const paginate = query({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    async handler(ctx, args) {
        let userId = await Auth.getUserId(ctx)

        let notifications = await ctx.db
            .query('notifications')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .order('desc')
            .paginate(args.paginationOpts)
        return notifications
    },
})
