import { Octokit } from '@octokit/rest'
import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { type ActionCtx, internalAction, internalQuery } from './_generated/server'
import { addSecret, octoCatch } from './utils'

export const getInstallationToken = internalQuery({
    args: {
        repoId: v.id('repos'),
    },

    async handler(ctx, { repoId }) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            console.error(`repo not found`, repoId)
            return null
        }

        let token = await ctx.db
            .query('installationAccessTokens')
            .withIndex('by_repo_id', (q) => q.eq('repoId', repo._id))
            .unique()
        if (!token) {
            console.error(`token not found`, repoId)
            return null
        }

        return token
    },
})

export const syncIssues = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo }) {
        let repoId = await ctx.runMutation(
            api.protected.upsertRepo,
            addSecret({
                owner,
                repo,
                private: false,
            }),
        )

        let token = await ctx.runAction(internal.githubAuth.generateGithubAppInstallationToken, {
            owner,
            repo,
        })

        let octo = new Octokit({ auth: token })
        let issues = await octo.rest.issues.listForRepo({ owner, repo })

        for (let issue of issues.data) {
            let labels: string[] = []
            for (let label of issue.labels ?? []) {
                if (typeof label === 'string') {
                    labels.push(label)
                } else if (label.name) {
                    labels.push(label.name)
                }
            }

            let assignees: string[] = []
            for (let assignee of issue.assignees ?? []) {
                if (assignee.login) {
                    assignees.push(assignee.login)
                }
            }

            if (issue.state !== 'open' && issue.state !== 'closed') {
                console.error(`unknown issue state`, issue.state)
                continue
            }

            await ctx.runMutation(internal.mutations.upsertIssue, {
                repo: repoId,
                githubId: issue.id,
                number: issue.number,
                title: issue.title,
                state: issue.state,
                body: issue.body ?? undefined,
                author: {
                    login: issue.user?.login ?? '',
                    id: issue.user?.id ?? 0,
                },
                labels,
                assignees,
                createdAt: issue.created_at,
                updatedAt: issue.updated_at,
                closedAt: issue.closed_at ?? undefined,
                comments: issue.comments ?? undefined,
            })
        }
    },
})

export const getPat = internalQuery({
    args: {
        userId: v.id('users'),
    },

    async handler(ctx, { userId }) {
        return ctx.db
            .query('pats')
            .withIndex('by_user_id', (q) => q.eq('userId', userId))
            .unique()
    },
})

export const downloadPublicRepo = internalAction({
    args: {
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, args) {
        return downloadPublicRepoAction(ctx, args)
    },
})

export async function downloadPublicRepoAction(
    ctx: ActionCtx,
    args: {
        userId: Id<'users'>
        owner: string
        repo: string
    },
) {
    let pat = await ctx.runQuery(api.protected.getPat, addSecret({ userId: args.userId }))
    if (!pat) {
        throw new Error('PAT not found')
    }

    let repoId = await ctx.runMutation(
        api.protected.upsertRepo,
        addSecret({
            owner: args.owner,
            repo: args.repo,
        }),
    )

    // fixme: we also need to create table that keeps track of the download status

    let octo = new Octokit({ auth: pat.token })

    let repo
    repo = await octoCatch(octo.rest.repos.get(args))
    if (repo.error) {
        let isUnauthorized = repo.error.status === 401
        let badCredentials = repo.error.message.includes('Bad credentials')

        if (isUnauthorized && badCredentials) {
            // fixme: we should actually tell the user somehow that the provided token is invalid
            throw new Error('Bad credentials')
        }

        throw repo.error
    }

    repo = repo.data

    // if repo is private the user has probably made a mistake. This is probably not possible if we've done a good job with the PATs.
    if (repo.private) {
        // fixme: we should actually tell the user somehow that the repo is private
        throw new Error('Repo is private')
    }

    {
        // check license, can we store the code?
        let license
        license = await octoCatch(
            octo.rest.licenses.getForRepo({ owner: args.owner, repo: args.repo }),
        )
        if (license.error) {
            if (license.error.status === 404) {
                throw new Error(`Repo license not found`)
            }
            throw license.error
        }

        license = license.data

        let spdxId = license.license?.spdx_id
        if (!spdxId) {
            throw new Error(`Repo license not found`)
        }
        if (!['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(spdxId)) {
            throw new Error(`Repo license ${spdxId} is not supported for public code download`)
        }
    }

    await downloadCommits(ctx, octo, repoId, args)
    await downloadRefs(ctx, octo, repoId, args)
    await downloadIssues(ctx, octo, repoId, args)
}

async function downloadRefs(
    ctx: ActionCtx,
    octo: Octokit,
    repoId: Id<'repos'>,
    args: {
        userId: Id<'users'>
        owner: string
        repo: string
    },
) {
    // get all repo branch / tag refs
    let allRefHeads = octo.paginate.iterator(octo.rest.git.listMatchingRefs, {
        owner: args.owner,
        repo: args.repo,
        ref: 'heads',
    })

    for await (let { data: refs } of allRefHeads) {
        for (let ref of refs) {
            // trim 'refs/heads/' substring
            let branchName = ref.ref.replace('refs/heads/', '')
            let commitSha = ref.object.sha

            let commitId = await ctx.runMutation(
                api.protected.upsertCommit,
                addSecret({ repoId, sha: commitSha }),
            )

            await ctx.runMutation(
                api.protected.upsertRef,
                addSecret({ repoId, commitId, ref: branchName, isTag: false }),
            )
        }
    }

    let allRefTags = octo.paginate.iterator(octo.rest.git.listMatchingRefs, {
        owner: args.owner,
        repo: args.repo,
        ref: 'tags',
    })

    for await (let { data: refs } of allRefTags) {
        for (let ref of refs) {
            // trim 'refs/tags/' substring
            let tagName = ref.ref.replace('refs/tags/', '')
            let commitSha = ref.object.sha

            let commitId = await ctx.runMutation(
                api.protected.upsertCommit,
                addSecret({ repoId, sha: commitSha }),
            )

            await ctx.runMutation(
                api.protected.upsertRef,
                addSecret({ repoId, commitId, ref: tagName, isTag: true }),
            )
        }
    }
}

async function downloadCommits(
    ctx: ActionCtx,
    octo: Octokit,
    repoId: Id<'repos'>,
    args: {
        userId: Id<'users'>
        owner: string
        repo: string
    },
) {
    let allCommits = octo.paginate.iterator(octo.rest.repos.listCommits, {
        owner: args.owner,
        repo: args.repo,
        per_page: 100,
    })

    for await (let { data: commits } of allCommits) {
        for (let commit of commits) {
            // To get the complete filetree for the commit, use the tree SHA from the commit object.
            // First, get the tree SHA from the commit:
            const treeSha = commit.commit.tree.sha

            let commitId = await ctx.runMutation(
                api.protected.upsertCommit,
                addSecret({ repoId, sha: commit.sha }),
            )

            let tree = await octoCatch(
                octo.rest.git.getTree({
                    owner: args.owner,
                    repo: args.repo,
                    tree_sha: treeSha,
                    recursive: 'true',
                }),
            )
            if (tree.error) {
                throw tree.error
            }

            let filenames = tree.data.tree.map((file) => file.path)
            await ctx.runMutation(
                api.protected.insertFilenames,
                addSecret({ commitId, fileList: filenames }),
            )

            for (let filename of filenames) {
                let file = await octoCatch(
                    octo.rest.repos.getContent({
                        owner: args.owner,
                        repo: args.repo,
                        ref: commit.sha,
                        path: filename,
                    }),
                )
                if (file.error) {
                    console.error(`file not found`, filename)
                    console.error('message', file.error.message)
                    console.error('status', file.error.status)
                    continue
                }

                if (Array.isArray(file.data)) {
                    console.error(`file is an array`, filename)
                    continue
                }

                if (file.data.type !== 'file') {
                    console.error(`file is not a file (lol)`, filename)
                    continue
                }

                let content = file.data.content
                await ctx.runMutation(
                    api.protected.insertFile,
                    addSecret({ repoId, commitId, filename, content }),
                )
            }
        }
    }
}

export async function downloadIssues(
    ctx: ActionCtx,
    octo: Octokit,
    repoId: Id<'repos'>,
    args: {
        userId: Id<'users'>
        owner: string
        repo: string
    },
) {
    let allIssues = octo.paginate.iterator(octo.rest.issues.listForRepo, {
        owner: args.owner,
        repo: args.repo,
    })

    for await (let { data: issues } of allIssues) {
        for (let issue of issues) {
            // await ctx.runMutation(
            //     api.protected.upsertIssue,
            //     addSecret({
            //         // repoId,
            //         // author: {
            //         //     login: issue.user?.login ?? '',
            //         //     id: issue.user?.id ?? 0,
            //         // },
            //         // labels: issue.labels ?? [],
            //         // assignees: issue.assignees ?? [],
            //         // createdAt: issue.created_at,
            //         // updatedAt: issue.updated_at,
            //         // closedAt: issue.closed_at ?? undefined,
            //         // githubId: issue.id,
            //         // number: issue.number,
            //         // title: issue.title,
            //         // state: issue.state,
            //         // body: issue.body ?? undefined,
            //         // author: { login: issue.user?.login ?? '', id: issue.user?.id ?? 0 },
            //         // labels: issue.labels ?? [],
            //         // assignees: issue.assignees ?? [],
            //         // createdAt: issue.created_at,
            //         // updatedAt: issue.updated_at,
            //         // closedAt: issue.closed_at ?? undefined,
            //         // comments: issue.comments ?? undefined,
            //     }),
            // )
        }
    }
}

export const syncPublicRepo = internalAction({
    args: {
        userId: v.id('users'),
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, args) {
        return syncPublicRepoAction(ctx, args)
    },
})

export async function syncPublicRepoAction(
    ctx: ActionCtx,
    args: {
        userId: Id<'users'>
        owner: string
        repo: string
    },
) {
    let pat = await ctx.runQuery(api.protected.getPat, addSecret({ userId: args.userId }))
    if (!pat) {
        throw new Error('PAT not found')
    }

    let octo = new Octokit({ auth: pat.token })

    let allRepoEvents = octo.paginate.iterator(octo.activity.listRepoEvents, {
        owner: args.owner,
        repo: args.repo,
        per_page: 100,
    })

    ctx.scheduler.runAfter

    // let totalReqs = 0

    for await (let { data: events } of allRepoEvents) {
        for (let event of events) {
            console.log(event)
        }
    }
}
