import type { Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import type { FnArgs } from '@convex/utils'
import { v } from 'convex/values'

export namespace Repos {
    export async function getByIds(ctx: QueryCtx, repoIds: Id<'repos'>[]) {
        let res
        res = repoIds.map((id) => ctx.db.get(id))
        res = await Promise.all(res)
        res = res.filter((r) => r !== null)
        return res
    }

    export const getByOwnerAndRepo = {
        args: { owner: v.string(), repo: v.string() },
        async handler(ctx: QueryCtx, args: FnArgs<typeof this>) {
            return ctx.db
                .query('repos')
                .withIndex('by_owner_and_repo', (q) =>
                    q.eq('owner', args.owner).eq('repo', args.repo),
                )
                .unique()
        },
    }

    export async function deleteById(ctx: MutationCtx, repoId: Id<'repos'>) {
        await ctx.db.delete(repoId)
    }

    export async function addToOpenIssuesCount(
        ctx: MutationCtx,
        repoId: Id<'repos'>,
        count: number,
    ) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            throw new Error(`repo not found: ${repoId}`)
        }

        await ctx.db.patch(repoId, { openIssues: repo.openIssues + count })
    }

    export async function addToClosedIssuesCount(
        ctx: MutationCtx,
        repoId: Id<'repos'>,
        count: number,
    ) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            throw new Error(`repo not found: ${repoId}`)
        }

        await ctx.db.patch(repoId, { closedIssues: repo.closedIssues + count })
    }

    export const upsertRepoForUser = {
        args: {
            userId: v.id('users'),
            owner: v.string(),
            repo: v.string(),
            private: v.boolean(),
        },
        async handler(ctx: MutationCtx, args: FnArgs<typeof this>) {
            let repoId
            let curr = await ctx.db
                .query('repos')
                .withIndex('by_owner_and_repo', (x) =>
                    x.eq('owner', args.owner).eq('repo', args.repo),
                )
                .unique()
            if (curr) {
                await ctx.db.patch(curr._id, { private: args.private })
                repoId = curr._id
            } else {
                repoId = await ctx.db.insert('repos', {
                    owner: args.owner,
                    repo: args.repo,
                    private: args.private,
                    openIssues: 0,
                    closedIssues: 0,
                    openPullRequests: 0,
                    closedPullRequests: 0,
                })
            }

            let currRel = await ctx.db
                .query('userRepos')
                .withIndex('by_userId_repoId', (x) =>
                    x.eq('userId', args.userId).eq('repoId', repoId),
                )
                .unique()
            if (!currRel) {
                await ctx.db.insert('userRepos', {
                    userId: args.userId,
                    repoId,
                })
            }

            return repoId
        },
    }
}
