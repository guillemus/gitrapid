import { vResultValidator } from '@convex-dev/workpool'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import { protectedMutation, protectedQuery } from '@convex/localcx'
import { v, type Infer } from 'convex/values'
import * as schemas from '../schema'

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
        await saveWorkflowRes(ctx, args)
    },
}

export const saveWorkflowResult = protectedMutation(SaveWorkflowResult)

async function saveWorkflowRes(
    ctx: MutationCtx,
    args: {
        repoId: Id<'repos'>
        lastSyncedAt: string
        workflowRes: Infer<typeof vResultValidator>
    },
) {
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
    } else res satisfies never
}

export const get = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => ctx.db.get(repoId),
})

export const insertNewRepoForUser = protectedMutation({
    args: {
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        let repoId = await ctx.db.insert('repos', {
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
        await ctx.db.insert('userRepos', {
            userId: args.userId,
            repoId,
        })
        return repoId
    },
})

export const getByOwnerAndRepo = protectedQuery({
    args: { owner: v.string(), repo: v.string() },
    handler: (ctx, { owner, repo }) => Repos.getByOwnerAndRepo(ctx, owner, repo),
})

export const deleteById = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Repos.deleteById(ctx, repoId),
})

export function canRepoBeSynced(repo: Doc<'repos'>) {
    return repo.download.status !== 'backfilling' && repo.download.status !== 'syncing'
}

export const updateDownloadStatus = protectedMutation({
    args: {
        repoId: v.id('repos'),
        download: schemas.reposSchema.download,
    },
    handler: (ctx, args) => Repos.updateDownload(ctx, args.repoId, args.download),
})

export function doesRepoNeedSyncing(repo: Doc<'repos'>) {
    return repo.download.status === 'cancelled' || repo.download.status === 'error'
}
