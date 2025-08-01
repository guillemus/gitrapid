import { Octokit } from '@octokit/rest'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalQuery } from './_generated/server'

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
            .first()
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
                owner,
                repo,
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
