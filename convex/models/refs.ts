import type { Id } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import { v } from 'convex/values'
import * as schemas from '../schema'
import { protectedMutation, protectedQuery } from '../utils'
import type { UpsertDoc } from './models'

export const Refs = {
    async get(ctx: QueryCtx, id: Id<'refs'>) {
        return ctx.db.get(id)
    },

    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let refs = await ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (q) => q.eq('repoId', repoId))
            .collect()
        for (let r of refs) {
            await ctx.db.delete(r._id)
        }
    },

    async getByRepoAndCommit(ctx: QueryCtx, repoId: Id<'repos'>, commitSha: string) {
        return ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (q) =>
                q.eq('repoId', repoId).eq('commitSha', commitSha),
            )
            .unique()
    },

    async getByRepoAndName(ctx: QueryCtx, repoId: Id<'repos'>, name: string) {
        return ctx.db
            .query('refs')
            .withIndex('by_repo_and_name', (q) => q.eq('repoId', repoId).eq('name', name))
            .unique()
    },

    async getFromRepo(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('refs')
            .withIndex('by_repo_and_commit', (q) => q.eq('repoId', repoId))
            .collect()
    },

    async upsertMany(ctx: MutationCtx, refs: UpsertDoc<'refs'>[]) {
        for (let ref of refs) {
            await this.patchOrCreate(ctx, ref)
        }
    },

    async replaceRepoRefs(ctx: MutationCtx, repoId: Id<'repos'>, newRefs: UpsertDoc<'refs'>[]) {
        let refs = await this.getFromRepo(ctx, repoId)
        for (let ref of refs) {
            await ctx.db.delete(ref._id)
        }

        for (let ref of newRefs) {
            await ctx.db.insert('refs', ref)
        }
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'refs'>) {
        let ref = await this.getByRepoAndCommit(ctx, args.repoId, args.commitSha)
        if (ref) {
            return ref
        }

        let id = await ctx.db.insert('refs', {
            repoId: args.repoId,
            commitSha: args.commitSha,
            name: args.name,
            isTag: args.isTag ?? false,
        })
        return await ctx.db.get(id)
    },

    async patchOrCreate(ctx: MutationCtx, args: UpsertDoc<'refs'>) {
        let ref = await this.getByRepoAndCommit(ctx, args.repoId, args.commitSha)
        if (ref) {
            await ctx.db.patch(ref._id, args)
            return await ctx.db.get(ref._id)
        }

        let id = await ctx.db.insert('refs', args)
        return await ctx.db.get(id)
    },
}

export const get = protectedQuery({
    args: { refId: v.id('refs') },
    handler: (ctx, { refId }) => Refs.get(ctx, refId),
})

export const getByRepoAndName = protectedQuery({
    args: { repoId: v.id('repos'), name: v.string() },
    handler: (ctx, { repoId, name }) => Refs.getByRepoAndName(ctx, repoId, name),
})

export const getByRepoAndCommit = protectedQuery({
    args: { repoId: v.id('repos'), commitSha: v.string() },
    handler: (ctx, { repoId, commitSha }) => Refs.getByRepoAndCommit(ctx, repoId, commitSha),
})

export const getRefsFromRepo = protectedQuery({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Refs.getFromRepo(ctx, repoId),
})

export const upsertMany = protectedMutation({
    args: {
        refs: v.array(v.object(schemas.refsSchema)),
    },
    handler: (ctx, { refs }) => Refs.upsertMany(ctx, refs),
})

export const replaceRepoRefs = protectedMutation({
    args: {
        repoId: v.id('repos'),
        refs: v.array(v.object(schemas.refsSchema)),
    },
    handler: (ctx, { repoId, refs }) => Refs.replaceRepoRefs(ctx, repoId, refs),
})

export const getOrCreate = protectedMutation({
    args: schemas.refsSchema,
    handler: (ctx, args) => Refs.getOrCreate(ctx, args),
})

export const patchOrCreate = protectedMutation({
    args: schemas.refsSchema,
    handler: (ctx, args) => Refs.patchOrCreate(ctx, args),
})

export const deleteByRepoId = protectedMutation({
    args: { repoId: v.id('repos') },
    handler: (ctx, { repoId }) => Refs.deleteByRepoId(ctx, repoId),
})
