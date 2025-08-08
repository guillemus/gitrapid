import type { WithoutSystemFields } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { type MutationCtx, internalMutation } from './_generated/server'
import { issuesSchema } from './schema'
import * as models from './models/models'

export const insertRefs = internalMutation({
    args: {
        repoId: v.id('repos'),
        refs: v.array(
            v.object({
                sha: v.string(),
                ref: v.string(),
                isTag: v.boolean(),
            }),
        ),
    },

    async handler(ctx, args) {
        for (let ref of args.refs) {
            let saved = await ctx.db
                .query('commits')
                .withIndex('by_repo_and_sha', (c) => c.eq('repoId', args.repoId).eq('sha', ref.sha))
                .unique()

            if (!saved) {
                console.error(`ref ${ref.ref} with inexistent sha ${ref.sha}`)
                continue
            }

            await ctx.db.insert('refs', {
                repoId: args.repoId,
                name: ref.ref,
                commitSha: saved.sha,
                isTag: ref.isTag,
            })
        }
    },
})

export const saveInstallationToken = internalMutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        token: v.string(),
        expiresAt: v.string(),
    },
    async handler(ctx, args) {
        let repo = await ctx.db
            .query('repos')
            .filter((q) => q.eq(q.field('owner'), args.owner) && q.eq(q.field('repo'), args.repo))
            .unique()
        if (!repo) {
            return null
        }

        let existingToken = await ctx.db
            .query('installationAccessTokens')
            .withIndex('by_repo_id', (q) => q.eq('repoId', repo._id))
            .unique()
        if (existingToken) {
            await ctx.db.delete(existingToken._id)
        }

        return ctx.db.insert('installationAccessTokens', {
            repoId: repo._id,
            token: args.token,
            expiresAt: args.expiresAt,
        })
    },
})

export const upsertIssue = internalMutation({
    args: issuesSchema,
    async handler(ctx, args) {
        return await upsertIssueMutation(ctx, args)
    },
})

export async function upsertIssueMutation(
    ctx: MutationCtx,
    args: WithoutSystemFields<Doc<'issues'>>,
) {
    // Use model-level upsert to also maintain repoCounts
    return await models.Issues.upsert(ctx, args)
}

export const getOrCreateRepo = internalMutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        return await models.Repos.getOrCreate(ctx, args)
    },
})

export const addInstallation = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        installationId: v.string(),
    },
    async handler(ctx, args) {
        return await models.Installations.getOrCreate(ctx, {
            userId: args.userId,
            repoId: args.repoId,
            installationId: args.installationId,
            suspended: false,
        })
    },
})

export const handleInstallationCreated = internalMutation({
    args: {
        installationId: v.string(),
        githubUserId: v.number(),
        repos: v.array(
            v.object({
                owner: v.string(),
                repo: v.string(),
                private: v.boolean(),
            }),
        ),
    },
    async handler(ctx, args) {
        const authAccount = await ctx.db
            .query('authAccounts')
            .withIndex('providerAndAccountId', (q) =>
                q.eq('provider', 'github').eq('providerAccountId', args.githubUserId.toString()),
            )
            .unique()

        if (!authAccount) {
            console.log(`User with GitHub ID ${args.githubUserId} not found in auth system.`)
            return
        }

        for (const repoData of args.repos) {
            const repoId = await upsertRepoMutation(ctx, repoData)

            await models.Installations.getOrCreate(ctx, {
                userId: authAccount.userId,
                repoId,
                installationId: args.installationId,
                suspended: false,
            })
        }

        console.log(`Successfully processed installation for user ${authAccount.userId}`)
    },
})

export const deleteInstallation = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
    },
    async handler(ctx, args) {
        let installation = await ctx.db
            .query('installations')
            .withIndex('by_userId_repoId', (q) =>
                q.eq('userId', args.userId).eq('repoId', args.repoId),
            )
            .unique()

        if (installation) {
            await ctx.db.delete(installation._id)
        }
    },
})

export const setInstallationSuspended = internalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        suspended: v.boolean(),
    },
    async handler(ctx, args) {
        let installation = await ctx.db
            .query('installations')
            .withIndex('by_userId_repoId', (q) =>
                q.eq('userId', args.userId).eq('repoId', args.repoId),
            )
            .unique()

        if (installation) {
            await ctx.db.patch(installation._id, { suspended: args.suspended })
        }
    },
})

async function upsertRepoMutation(
    ctx: MutationCtx,
    args: { owner: string; repo: string; private: boolean },
) {
    let existing = await ctx.db
        .query('repos')
        .filter((r) => r.eq(r.field('owner'), args.owner) && r.eq(r.field('repo'), args.repo))
        .unique()
    if (existing) {
        await ctx.db.patch(existing._id, { private: args.private })
        return existing._id
    } else {
        let repoId = await ctx.db.insert('repos', args)
        await ctx.db.insert('repoCounts', {
            repoId,
            openIssues: 0,
            closedIssues: 0,
            openPullRequests: 0,
            closedPullRequests: 0,
        })
        return repoId
    }
}

export const setRepoHead = internalMutation({
    args: {
        repoId: v.id('repos'),
        headRefName: v.string(),
    },
    async handler(ctx, args) {
        return await models.setRepoHead(ctx, args.repoId, args.headRefName)
    },
})
