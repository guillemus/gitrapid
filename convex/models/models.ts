import type { Doc, Id, TableNames } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import type { WithoutSystemFields } from 'convex/server'

export type UpsertDoc<T extends TableNames> = WithoutSystemFields<Doc<T>>

export const Repos = {
    async getByOwnerAndRepo(ctx: QueryCtx, owner: string, repo: string) {
        return ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (q) => q.eq('owner', owner).eq('repo', repo))
            .unique()
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'repos'>) {
        let repo = await this.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (repo) {
            return repo._id
        }

        return ctx.db.insert('repos', {
            owner: args.owner,
            repo: args.repo,
            private: args.private,
        })
    },
}

export const RepoCounts = {
    async getByRepoId(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('repoCounts')
            .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'repoCounts'>) {
        let existing = await this.getByRepoId(ctx, args.repoId)
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('repoCounts', args)
    },

    async setOpenIssues(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { openIssues: count })
    },

    async setClosedIssues(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { closedIssues: count })
    },

    async setOpenPullRequests(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { openPullRequests: count })
    },

    async setClosedPullRequests(ctx: MutationCtx, repoCountId: Id<'repoCounts'>, count: number) {
        return ctx.db.patch(repoCountId, { closedPullRequests: count })
    },
}

export const Refs = {
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

    async getRefsFromRepo(ctx: QueryCtx, repoId: Id<'repos'>) {
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

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'refs'>) {
        let ref = await this.getByRepoAndCommit(ctx, args.repoId, args.commitSha)
        if (ref) {
            return ref._id
        }

        return ctx.db.insert('refs', {
            repoId: args.repoId,
            commitSha: args.commitSha,
            name: args.name,
            isTag: args.isTag ?? false,
        })
    },

    async patchOrCreate(ctx: MutationCtx, args: UpsertDoc<'refs'>) {
        let ref = await this.getByRepoAndCommit(ctx, args.repoId, args.commitSha)
        if (ref) {
            return ctx.db.patch(ref._id, args)
        }

        return ctx.db.insert('refs', args)
    },
}

export const Issues = {
    async getByRepoAndNumber(ctx: QueryCtx, args: { repoId: Id<'repos'>; number: number }) {
        return ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) =>
                q.eq('repoId', args.repoId).eq('number', args.number),
            )
            .unique()
    },

    async listByRepo(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) => q.eq('repoId', repoId))
            .collect()
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'issues'>) {
        let issue = await this.getByRepoAndNumber(ctx, args)
        if (issue) {
            return issue._id
        }

        return ctx.db.insert('issues', args)
    },
}

export const Installations = {
    async getByUserIdAndRepoId(ctx: QueryCtx, userId: Id<'users'>, repoId: Id<'repos'>) {
        return ctx.db
            .query('installations')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId).eq('repoId', repoId))
            .unique()
    },

    async listInstalledRepos(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db
            .query('installations')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId))
            .collect()
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'installations'>) {
        let existing = await this.getByUserIdAndRepoId(ctx, args.userId, args.repoId)
        if (existing) {
            return existing._id
        }

        return ctx.db.insert('installations', args)
    },
}

/**
 * Personal Access Tokens
 */
export const PAT = {
    async getByUserId(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', userId))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'pats'>) {
        let existing = await this.getByUserId(ctx, args.userId)
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('pats', args)
    },
}

export const AuthAccounts = {
    async getByProviderAndAccountId(ctx: QueryCtx, providerAccountId: string) {
        return ctx.db
            .query('authAccounts')
            .withIndex('providerAndAccountId', (q) =>
                q.eq('provider', 'github').eq('providerAccountId', providerAccountId),
            )
            .unique()
    },
}

export const Blobs = {
    async getByRepoAndSha(ctx: QueryCtx, repoId: Id<'repos'>, sha: string) {
        return ctx.db
            .query('blobs')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId).eq('sha', sha))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'blobs'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('blobs', args)
    },
}

export const Trees = {
    async getByRepoAndSha(ctx: QueryCtx, repoId: Id<'repos'>, sha: string) {
        return ctx.db
            .query('trees')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId).eq('sha', sha))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'trees'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('trees', args)
    },
}

export const TreeEntries = {
    async getByRepoAndTreeAndEntry(
        ctx: QueryCtx,
        repoId: Id<'repos'>,
        rootTreeSha: string,
        path: string,
    ) {
        return ctx.db
            .query('treeEntries')
            .withIndex('by_repo_tree_and_path', (q) =>
                q.eq('repoId', repoId).eq('rootTreeSha', rootTreeSha).eq('path', path),
            )
            .unique()
    },

    async getByRepoAndTree(ctx: QueryCtx, repoId: Id<'repos'>, rootTreeSha: string) {
        return ctx.db
            .query('treeEntries')
            .withIndex('by_repo_tree_and_path', (q) =>
                q.eq('repoId', repoId).eq('rootTreeSha', rootTreeSha),
            )
            .collect()
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'treeEntries'>) {
        let existing = await this.getByRepoAndTreeAndEntry(
            ctx,
            args.repoId,
            args.rootTreeSha,
            args.path,
        )
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('treeEntries', args)
    },
}

export const Commits = {
    async getByRepoAndSha(ctx: QueryCtx, repoId: Id<'repos'>, sha: string) {
        return ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId).eq('sha', sha))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'commits'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('commits', args)
    },
}

export const IssueComments = {
    async getByGithubId(ctx: QueryCtx, githubId: number) {
        return ctx.db
            .query('issueComments')
            .withIndex('by_github_id', (q) => q.eq('githubId', githubId))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'issueComments'>) {
        let existing = await this.getByGithubId(ctx, args.githubId)
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('issueComments', args)
    },
}

export const InstallationAccessTokens = {
    async getByRepoId(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('installationAccessTokens')
            .withIndex('by_repo_id', (q) => q.eq('repoId', repoId))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'installationAccessTokens'>) {
        let existing = await this.getByRepoId(ctx, args.repoId)
        if (existing) {
            return existing._id
        }
        return ctx.db.insert('installationAccessTokens', args)
    },
}

export async function getUserInstallationToken(
    ctx: QueryCtx,
    userId: Id<'users'>,
    repoId: Id<'repos'>,
) {
    let installation = await Installations.getByUserIdAndRepoId(ctx, userId, repoId)
    if (!installation) {
        return null
    }

    return await InstallationAccessTokens.getByRepoId(ctx, repoId)
}

export async function setRepoHead(ctx: MutationCtx, repoId: Id<'repos'>, headRefName: string) {
    // check first if ref exists
    let ref = await Refs.getByRepoAndName(ctx, repoId, headRefName)
    if (!ref) return null

    return await ctx.db.patch(repoId, { headId: ref._id })
}
