import { mutation } from './_generated/server'
import { getUserId } from './utils'

export const deleteMyPAT = mutation({
    args: {},
    async handler(ctx) {
        let userId = await getUserId(ctx)

        let pat = await ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', userId))
            .unique()

        if (pat) {
            await ctx.db.delete(pat._id)
        }
    },
})
