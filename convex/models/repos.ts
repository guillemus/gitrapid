import { vResultValidator } from '@convex-dev/workpool'
import type { Doc, Id } from '@convex/_generated/dataModel'
import {
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@convex/_generated/server'
import { v, type Infer } from 'convex/values'
import schema from '../schema'

export const Repos = {
    async getByIds(ctx: QueryCtx, repoIds: Id<'repos'>[]) {
        let res
        res = repoIds.map((id) => ctx.db.get(id))
        res = await Promise.all(res)
        res = res.filter((r) => r !== null)
        return res
    },

    async getByOwnerAndRepo(ctx: QueryCtx, owner: string, repo: string) {
        return ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (q) => q.eq('owner', owner).eq('repo', repo))
            .unique()
    },

    async deleteById(ctx: MutationCtx, repoId: Id<'repos'>) {
        await ctx.db.delete(repoId)
    },

    async addToOpenIssuesCount(ctx: MutationCtx, repoId: Id<'repos'>, count: number) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            throw new Error(`repo not found: ${repoId}`)
        }

        await ctx.db.patch(repoId, { openIssues: repo.openIssues + count })
    },

    async addToClosedIssuesCount(ctx: MutationCtx, repoId: Id<'repos'>, count: number) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            throw new Error(`repo not found: ${repoId}`)
        }

        await ctx.db.patch(repoId, { closedIssues: repo.closedIssues + count })
    },

    async updateDownload(
        ctx: MutationCtx,
        repoId: Id<'repos'>,
        download: Doc<'repos'>['download'],
    ) {
        await ctx.db.patch(repoId, { download })
    },
}

export const SaveWorkflowResult = {
    args: v.object({
        repoId: v.id('repos'),
        lastSyncedAt: v.string(),
        workflowRes: vResultValidator,
    }),
    async handler(ctx: MutationCtx, args: Infer<typeof this.args>) {
        let res = args.workflowRes
        if (res.kind === 'canceled') {
            await ctx.db.patch(args.repoId, {
                download: {
                    status: 'cancelled',
                    lastSyncedAt: args.lastSyncedAt,
                },
            })
        } else if (res.kind === 'failed') {
            await ctx.db.patch(args.repoId, {
                download: {
                    status: 'error',
                    message: res.error,
                    lastSyncedAt: args.lastSyncedAt,
                },
            })
        } else if (res.kind === 'success') {
            await ctx.db.patch(args.repoId, {
                download: {
                    status: 'success',
                    lastSyncedAt: args.lastSyncedAt,
                },
            })
        } else {
            let _ = res satisfies never
        }
    },
}

export const saveWorkflowResult = internalMutation(SaveWorkflowResult)

export const get = internalQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => ctx.db.get(repoId),
})

export const upsertRepoForUser = internalMutation({
    args: {
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        let repoId
        let curr = await ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (x) => x.eq('owner', args.owner).eq('repo', args.repo))
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
                download: {
                    status: 'initial',
                },
            })
        }

        let currRel = await ctx.db
            .query('userRepos')
            .withIndex('by_userId_repoId', (x) => x.eq('userId', args.userId).eq('repoId', repoId))
            .unique()
        if (!currRel) {
            await ctx.db.insert('userRepos', {
                userId: args.userId,
                repoId,
            })
        }

        return repoId
    },
})

export const getByOwnerAndRepo = internalQuery({
    args: { owner: v.string(), repo: v.string() },
    handler: (ctx, { owner, repo }) => Repos.getByOwnerAndRepo(ctx, owner, repo),
})

export const deleteById = internalMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Repos.deleteById(ctx, repoId),
})

export function canRepoBeSynced(repo: Doc<'repos'>) {
    return repo.download.status !== 'backfilling' && repo.download.status !== 'syncing'
}

export const updateDownloadStatus = internalMutation({
    args: {
        repoId: v.id('repos'),
        download: schema.tables.repos.validator.fields.download,
    },
    handler: (ctx, args) => Repos.updateDownload(ctx, args.repoId, args.download),
})

export function doesRepoNeedSyncing(repo: Doc<'repos'>) {
    return repo.download.status === 'cancelled' || repo.download.status === 'error'
}
