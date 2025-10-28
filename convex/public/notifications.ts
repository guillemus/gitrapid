import { Notifications } from '@convex/models/notifications'
import { Repos } from '@convex/models/repos'
import { publicQuery } from '@convex/utils'
import { asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const allRepos = publicQuery(async (ctx) => {
    return Notifications.distinctRepos(ctx, ctx.userId)
})

export const list = publicQuery({
    args: {
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
