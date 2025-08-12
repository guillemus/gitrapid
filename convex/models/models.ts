import type { Doc, Id, TableNames } from '@convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '@convex/_generated/server'
import type { WithoutSystemFields } from 'convex/server'
import { err, failure } from '../utils'

export type UpsertDoc<T extends TableNames> = WithoutSystemFields<Doc<T>>

export const Repos = {
    async getByOwnerAndRepo(ctx: QueryCtx, owner: string, repo: string) {
        return ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (q) => q.eq('owner', owner).eq('repo', repo))
            .unique()
    },

    async getByOwnerRepo(ctx: QueryCtx, owner: string, repo: string) {
        return ctx.db
            .query('repos')
            .withIndex('by_owner_and_repo', (q) => q.eq('owner', owner).eq('repo', repo))
            .unique()
    },

    async get(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db.get(repoId)
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'repos'>) {
        let repo = await this.getByOwnerAndRepo(ctx, args.owner, args.repo)
        if (repo) {
            return repo
        }

        let repoId = await ctx.db.insert('repos', {
            owner: args.owner,
            repo: args.repo,
            private: args.private,
        })

        // Ensure a matching repoCounts row exists
        await RepoCounts.getOrCreate(ctx, {
            repoId,
            openIssues: 0,
            closedIssues: 0,
            openPullRequests: 0,
            closedPullRequests: 0,
        })

        return await ctx.db.get(repoId)
    },
    async deleteById(ctx: MutationCtx, repoId: Id<'repos'>) {
        await ctx.db.delete(repoId)
    },
}

export const SyncStates = {
    async getByRepoId(ctx: QueryCtx, repoId: Id<'repos'>) {
        return ctx.db
            .query('syncStates')
            .withIndex('by_repoId', (q) => q.eq('repoId', repoId))
            .unique()
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'syncStates'>) {
        let existing = await this.getByRepoId(ctx, args.repoId)
        if (existing) return existing

        let id = await ctx.db.insert('syncStates', args)
        return await ctx.db.get(id)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'syncStates'>) {
        let existing = await this.getByRepoId(ctx, args.repoId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        let id = await ctx.db.insert('syncStates', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let existing = await this.getByRepoId(ctx, repoId)
        if (existing) {
            await ctx.db.delete(existing._id)
        }
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
            return existing
        }
        let id = await ctx.db.insert('repoCounts', args)
        return await ctx.db.get(id)
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
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let existing = await this.getByRepoId(ctx, repoId)
        if (existing) {
            await ctx.db.delete(existing._id)
        }
    },
}

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
            return issue
        }

        let id = await ctx.db.insert('issues', args)

        // Update repo counts on insert
        let counts = await RepoCounts.getByRepoId(ctx, args.repoId)
        if (counts) {
            if (args.state === 'open') {
                await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
            } else {
                await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
            }
        }

        return await ctx.db.get(id)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'issues'>) {
        let existing = await this.getByRepoAndNumber(ctx, args)
        if (existing) {
            // Adjust counts if state changed
            if (existing.state !== args.state) {
                let counts = await RepoCounts.getByRepoId(ctx, existing.repoId)
                if (counts) {
                    if (args.state === 'open') {
                        await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
                        await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues - 1)
                    } else {
                        await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues - 1)
                        await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
                    }
                }
            }
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        // Insert new issue and bump counts
        let id = await ctx.db.insert('issues', args)
        let counts = await RepoCounts.getByRepoId(ctx, args.repoId)
        if (counts) {
            if (args.state === 'open') {
                await RepoCounts.setOpenIssues(ctx, counts._id, counts.openIssues + 1)
            } else {
                await RepoCounts.setClosedIssues(ctx, counts._id, counts.closedIssues + 1)
            }
        }
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let issues = await ctx.db
            .query('issues')
            .withIndex('by_repo_and_number', (q) => q.eq('repoId', repoId))
            .collect()
        for (let issue of issues) {
            await IssueComments.deleteByIssueId(ctx, issue._id)
            await ctx.db.delete(issue._id)
        }
    },
}

export const Installations = {
    async getByUserIdAndRepoId(ctx: QueryCtx, userId: Id<'users'>, repoId: Id<'repos'>) {
        return ctx.db
            .query('installations')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId).eq('repoId', repoId))
            .unique()
    },

    async listUserInstallations(ctx: QueryCtx, userId: Id<'users'>) {
        return ctx.db
            .query('installations')
            .withIndex('by_userId_repoId', (q) => q.eq('userId', userId))
            .collect()
    },

    async getByGithubInstallationId(ctx: QueryCtx, githubInstallationId: number) {
        return ctx.db
            .query('installations')
            .withIndex('by_githubInstallationId', (q) =>
                q.eq('githubInstallationId', githubInstallationId),
            )
            .unique()
    },

    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'installations'>) {
        let existing = await this.getByUserIdAndRepoId(ctx, args.userId, args.repoId)
        if (existing) {
            return existing
        }

        let id = await ctx.db.insert('installations', args)
        return await ctx.db.get(id)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'installations'>) {
        let existing = await this.getByGithubInstallationId(ctx, args.githubInstallationId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        let id = await ctx.db.insert('installations', args)
        return await ctx.db.get(id)
    },

    async deleteByUserAndRepo(ctx: MutationCtx, userId: Id<'users'>, repoId: Id<'repos'>) {
        let installation = await this.getByUserIdAndRepoId(ctx, userId, repoId)
        if (installation) {
            await ctx.db.delete(installation._id)
        }
    },

    async setSuspendedByUserAndRepo(
        ctx: MutationCtx,
        userId: Id<'users'>,
        repoId: Id<'repos'>,
        suspended: boolean,
    ) {
        let installation = await this.getByUserIdAndRepoId(ctx, userId, repoId)
        if (installation) {
            await ctx.db.patch(installation._id, { suspended })
        }
    },

    async delete(ctx: MutationCtx, installationId: Id<'installations'>) {
        await ctx.db.delete(installationId)
    },

    async deleteByGithubInstallationId(ctx: MutationCtx, githubInstallationId: number) {
        let installation = await this.getByGithubInstallationId(ctx, githubInstallationId)
        if (installation) {
            await ctx.db.delete(installation._id)
        }
    },

    async setSuspendedByGithubInstallationId(
        ctx: MutationCtx,
        githubInstallationId: number,
        suspended: boolean,
    ) {
        let installation = await this.getByGithubInstallationId(ctx, githubInstallationId)
        if (installation) {
            await ctx.db.patch(installation._id, { suspended })
        }
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
            return existing
        }
        let id = await ctx.db.insert('pats', args)
        return await ctx.db.get(id)
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

/**
 * Get the stored user ID from a GitHub user ID.
 */
export async function getUserIdFromGithubUserId(ctx: QueryCtx, githubUserId: number) {
    let account = await AuthAccounts.getByProviderAndAccountId(ctx, githubUserId.toString())
    return account?.userId
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
            return existing
        }
        let id = await ctx.db.insert('blobs', args)
        return await ctx.db.get(id)
    },
    async patchOrCreate(ctx: MutationCtx, args: UpsertDoc<'blobs'>) {
        let existing = await this.getByRepoAndSha(ctx, args.repoId, args.sha)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }
        let id = await ctx.db.insert('blobs', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let blobs = await ctx.db
            .query('blobs')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId))
            .collect()
        for (let b of blobs) {
            await ctx.db.delete(b._id)
        }
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
            return existing
        }
        let id = await ctx.db.insert('trees', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let trees = await ctx.db
            .query('trees')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId))
            .collect()
        for (let t of trees) {
            await ctx.db.delete(t._id)
        }
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
            return existing
        }
        let id = await ctx.db.insert('treeEntries', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let entries = await ctx.db
            .query('treeEntries')
            .withIndex('by_repo_tree_and_path', (q) => q.eq('repoId', repoId))
            .collect()
        for (let e of entries) {
            await ctx.db.delete(e._id)
        }
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
            return existing
        }
        let id = await ctx.db.insert('commits', args)
        return await ctx.db.get(id)
    },
    async deleteByRepoId(ctx: MutationCtx, repoId: Id<'repos'>) {
        let commits = await ctx.db
            .query('commits')
            .withIndex('by_repo_and_sha', (q) => q.eq('repoId', repoId))
            .collect()
        for (let c of commits) {
            await ctx.db.delete(c._id)
        }
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
            return existing
        }
        let id = await ctx.db.insert('issueComments', args)
        return await ctx.db.get(id)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'issueComments'>) {
        let existing = await this.getByGithubId(ctx, args.githubId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }
        let id = await ctx.db.insert('issueComments', args)
        return await ctx.db.get(id)
    },
    async deleteByIssueId(ctx: MutationCtx, issueId: Id<'issues'>) {
        let comments = await ctx.db
            .query('issueComments')
            .withIndex('by_issue', (q) => q.eq('issueId', issueId))
            .collect()
        for (let c of comments) {
            await ctx.db.delete(c._id)
        }
    },
}

export const InstallationAccessTokens = {
    async getByInstallationId(ctx: QueryCtx, installationId: Id<'installations'>) {
        return ctx.db
            .query('installationAccessTokens')
            .withIndex('by_installationId', (q) => q.eq('installationId', installationId))
            .unique()
    },
    async getOrCreate(ctx: MutationCtx, args: UpsertDoc<'installationAccessTokens'>) {
        let existing = await this.getByInstallationId(ctx, args.installationId)
        if (existing) {
            return existing
        }
        let id = await ctx.db.insert('installationAccessTokens', args)
        return await ctx.db.get(id)
    },

    async upsert(ctx: MutationCtx, args: UpsertDoc<'installationAccessTokens'>) {
        let existing = await this.getByInstallationId(ctx, args.installationId)
        if (existing) {
            await ctx.db.patch(existing._id, args)
            return await ctx.db.get(existing._id)
        }

        let id = await ctx.db.insert('installationAccessTokens', args)
        return await ctx.db.get(id)
    },
    async deleteByInstallationId(ctx: MutationCtx, installationId: Id<'installations'>) {
        let token = await this.getByInstallationId(ctx, installationId)
        if (token) {
            await ctx.db.delete(token._id)
        }
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

    return await InstallationAccessTokens.getByInstallationId(ctx, installation._id)
}

export async function setRepoHead(ctx: MutationCtx, repoId: Id<'repos'>, headRefName: string) {
    // check first if ref exists
    let ref = await Refs.getByRepoAndName(ctx, repoId, headRefName)
    if (!ref) return null

    return await ctx.db.patch(repoId, { headId: ref._id })
}

export async function createInstallation(
    ctx: MutationCtx,
    args: {
        githubInstallationId: number
        githubUserId: number
        repos: { owner: string; repo: string; private: boolean }[]
    },
) {
    const authAccount = await AuthAccounts.getByProviderAndAccountId(
        ctx,
        args.githubUserId.toString(),
    )
    if (!authAccount) {
        console.log(`User with GitHub ID ${args.githubUserId} not found in auth system.`)
        return
    }

    for (const repoData of args.repos) {
        const repo = await Repos.getOrCreate(ctx, repoData)
        if (!repo) {
            console.log(`Failed to create repo ${repoData.owner}/${repoData.repo}`)
            continue
        }

        await Installations.getOrCreate(ctx, {
            userId: authAccount.userId,
            repoId: repo._id,
            githubInstallationId: args.githubInstallationId,
            suspended: false,
        })
    }

    console.log(`Successfully processed installation for user ${authAccount.userId}`)
}

export async function deleteInstalledRepositoryData(
    ctx: MutationCtx,
    args: {
        githubInstallationId: number
        githubUserId: number
        repo: { owner: string; repo: string }
    },
) {
    // Resolve local user from GitHub user id
    let authAccount = await AuthAccounts.getByProviderAndAccountId(
        ctx,
        args.githubUserId.toString(),
    )
    if (!authAccount) {
        return err('auth account not found')
    }

    // Find repo
    let repo = await Repos.getByOwnerAndRepo(ctx, args.repo.owner, args.repo.repo)
    if (!repo) {
        return err('repo not found')
    }

    // Verify the user actually has an installation for this repo
    let installation = await Installations.getByUserIdAndRepoId(ctx, authAccount.userId, repo._id)
    if (!installation) {
        return err('installation not found')
    }

    // Ensure the installation matches the provided githubInstallationId
    if (installation.githubInstallationId !== args.githubInstallationId) {
        return err('installation does not match')
    }

    // Delete installation access token (if any) and installation row
    await InstallationAccessTokens.deleteByInstallationId(ctx, installation._id)
    await Installations.delete(ctx, installation._id)

    // Delete sync state and repo counts
    await SyncStates.deleteByRepoId(ctx, repo._id)
    await RepoCounts.deleteByRepoId(ctx, repo._id)

    // Delete issues (and their comments) via helper
    await Issues.deleteByRepoId(ctx, repo._id)

    // Delete refs, commits, tree entries, trees, blobs via helpers
    await Refs.deleteByRepoId(ctx, repo._id)
    await Commits.deleteByRepoId(ctx, repo._id)
    await TreeEntries.deleteByRepoId(ctx, repo._id)
    await Trees.deleteByRepoId(ctx, repo._id)
    await Blobs.deleteByRepoId(ctx, repo._id)

    // Finally delete the repo itself via helper
    await Repos.deleteById(ctx, repo._id)
}
