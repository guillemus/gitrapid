import { query } from '@convex/_generated/server'
import { RepoDownloadStatus } from '@convex/models/repoDownloadStatus'
import { UserRepos } from '@convex/models/userRepos'
import { getUserId } from '@convex/utils'
import { v } from 'convex/values'

export const get = query({
    args: {},
    async handler(ctx) {
        let userId = await getUserId(ctx)
        let userRepos = await ctx.db
            .query('userRepos')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId))
            .collect()

        let repoIds = userRepos.map((ur) => ur.repoId)
        let repos = await Promise.all(repoIds.map((id) => ctx.db.get(id)))
        return repos.filter((r) => r !== null)
    },
})

export const getDownloadStatus = query({
    args: {
        repoId: v.id('repos'),
    },
    async handler(ctx, { repoId }) {
        let userId = await getUserId(ctx)

        let hasRepo = await UserRepos.userHasRepo(ctx, userId, repoId)
        if (!hasRepo) {
            throw new Error('not authorized to this repo')
        }

        let status = await RepoDownloadStatus.getByRepoId(ctx, repoId)
        if (!status) return

        return {
            status: status.status,
            message: status.message,
        }
    },
})
