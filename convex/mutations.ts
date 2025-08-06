import type { WithoutSystemFields } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { type MutationCtx } from './_generated/server'
import { appInternalMutation } from './triggers'
import { issuesSchema } from './schema'

export const insertRefs = appInternalMutation({
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
                commitId: saved._id,
                isTag: ref.isTag,
            })
        }
    },
})

export const saveInstallationToken = appInternalMutation({
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

export const upsertIssue = appInternalMutation({
    args: issuesSchema,
    async handler(ctx, args) {
        return await upsertIssueMutation(ctx, args)
    },
})

export async function upsertIssueMutation(
    ctx: MutationCtx,
    args: WithoutSystemFields<Doc<'issues'>>,
) {
    const existing = await ctx.db
        .query('issues')
        .withIndex('by_repo_and_number', (q) =>
            q.eq('repoId', args.repoId).eq('number', args.number),
        )
        .unique()
    if (existing) {
        return await ctx.db.patch(existing._id, args)
    } else {
        return await ctx.db.insert('issues', args)
    }
}

export const upsertRepo = appInternalMutation({
    args: {
        owner: v.string(),
        repo: v.string(),
        private: v.boolean(),
    },
    async handler(ctx, args) {
        return await upsertRepoMutation(ctx, args)
    },
})

export const addInstallation = appInternalMutation({
    args: {
        userId: v.id('users'),
        repoId: v.id('repos'),
        installationId: v.string(),
    },
    async handler(ctx, args) {
        return await addInstallationMutation(ctx, args)
    },
})

export const handleInstallationCreated = appInternalMutation({
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

            await addInstallationMutation(ctx, {
                userId: authAccount.userId,
                repoId,
                installationId: args.installationId,
            })
        }

        console.log(`Successfully processed installation for user ${authAccount.userId}`)
    },
})

export const deleteInstallation = appInternalMutation({
    args: {
        installationId: v.string(),
    },
    async handler(ctx, args) {
        let installation = await ctx.db
            .query('installations')
            .withIndex('by_installationId', (q) => q.eq('installationId', args.installationId))
            .unique()

        if (installation) {
            await ctx.db.delete(installation._id)
        }
    },
})

export const setInstallationSuspended = appInternalMutation({
    args: {
        installationId: v.string(),
        suspended: v.boolean(),
    },
    async handler(ctx, args) {
        let installation = await ctx.db
            .query('installations')
            .withIndex('by_installationId', (q) => q.eq('installationId', args.installationId))
            .unique()

        if (installation) {
            await ctx.db.patch(installation._id, { suspended: args.suspended })
        }
    },
})

async function addInstallationMutation(
    ctx: MutationCtx,
    args: {
        userId: Id<'users'>
        repoId: Id<'repos'>
        installationId: string
    },
) {
    let existing = await ctx.db
        .query('installations')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .filter((i) => i.eq(i.field('repoId'), args.repoId))
        .unique()
    if (!existing) {
        await ctx.db.insert('installations', {
            installationId: args.installationId,
            userId: args.userId,
            repoId: args.repoId,
            suspended: false,
        })
    }
}

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
