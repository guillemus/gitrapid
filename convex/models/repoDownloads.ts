// import type { Doc, Id } from '@convex/_generated/dataModel'
// import { type MutationCtx, type QueryCtx } from '@convex/_generated/server'
// import { err, ok } from '@convex/shared'
// import { v } from 'convex/values'
// import * as schemas from '../schema'
// import { protectedMutation, protectedQuery } from '../utils'
// import type { UpsertDoc } from './models'

// export const RepoDownloads = {
//     async getByRepoId(ctx: QueryCtx, repoId: Id<'repos'>) {
//         return ctx.db
//             .query('repoDownloads')
//             .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
//             .unique()
//     },

//     async upsert(ctx: MutationCtx, args: UpsertDoc<'repoDownloads'>) {
//         let existing = await this.getByRepoId(ctx, args.repoId)
//         if (existing) {
//             await ctx.db.patch(existing._id, args)
//             return await ctx.db.get(existing._id)
//         }

//         let id = await ctx.db.insert('repoDownloads', args)
//         return await ctx.db.get(id)
//     },

//     async updateSince(ctx: MutationCtx, repoId: Id<'repos'>, syncedSince: string) {
//         let existing = await this.getByRepoId(ctx, repoId)
//         if (!existing) return null

//         await ctx.db.patch(existing._id, { syncedSince })
//         return await ctx.db.get(existing._id)
//     },

//     async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
//         let existing = await this.getByRepoId(ctx, repoId)
//         if (existing) {
//             await ctx.db.delete(existing._id)
//         }
//     },

//     async cancelDownload(ctx: MutationCtx, owner: string, repo: string): R {
//         let savedRepo = await ctx.db
//             .query('repos')
//             .withIndex('by_owner_and_repo', (q) => q.eq('owner', owner).eq('repo', repo))
//             .unique()
//         if (!savedRepo) {
//             return err('repo not found')
//         }

//         let download = await RepoDownloads.getByRepoId(ctx, savedRepo._id)
//         if (!download) {
//             return err('download not found')
//         }

//         await ctx.db.patch(download._id, { status: 'cancelled' })
//         return ok()
//     },

//     async upsertIfNotCancelled(ctx: MutationCtx, args: UpsertDoc<'repoDownloads'>): R {
//         let existing = await this.getByRepoId(ctx, args.repoId)
//         if (existing) {
//             if (existing.status === 'cancelled') {
//                 return err('download was cancelled')
//             }

//             await ctx.db.patch(existing._id, args)
//         } else {
//             await ctx.db.insert('repoDownloads', args)
//         }

//         return ok()
//     },
// }

// export const getByRepoId = protectedQuery({
//     args: { repoId: v.id('repos') },
//     handler: (ctx, { repoId }) => RepoDownloads.getByRepoId(ctx, repoId),
// })

// export const upsertIfNotCancelled = protectedMutation({
//     args: schemas.repoDownloadsSchema,
//     handler: (ctx, args) => RepoDownloads.upsertIfNotCancelled(ctx, args),
// })

// export const updateSince = protectedMutation({
//     args: {
//         repoId: v.id('repos'),
//         syncedSince: v.string(),
//     },
//     handler: (ctx, args) => RepoDownloads.updateSince(ctx, args.repoId, args.syncedSince),
// })

// export const deleteByRepoId = protectedMutation({
//     args: { repoId: v.id('repos') },
//     handler: (ctx, { repoId }) => RepoDownloads.deleteByRepoId(ctx, repoId),
// })

// export const cancel = protectedMutation({
//     args: { owner: v.string(), repo: v.string() },
//     handler: async (ctx, { owner, repo }) => {
//         return RepoDownloads.cancelDownload(ctx, owner, repo)
//     },
// })
