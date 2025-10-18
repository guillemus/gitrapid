import { authTables } from '@convex-dev/auth/server'
import { vWorkflowId } from '@convex-dev/workflow'
import { brandedString } from 'convex-helpers/validators'
import { defineSchema, defineTable } from 'convex/server'
import { v, type Infer, type Validator } from 'convex/values'

const possibleGithubUser = v.union(
    // Null means that the user no longer exists or for some reason the actor could not be fetched from github.
    // This could be the equivalent of the "ghost" user.
    v.null(),
    v.literal('github-actions'),
    v.id('githubUsers'),
)

export type PossibleGithubUser = Infer<typeof possibleGithubUser>

export const v_etag = brandedString('etag')
export type Etag = Infer<typeof v_etag>

export const v_nextSyncAt = brandedString('nextSyncAt')
export type NextSyncAt = Infer<typeof v_nextSyncAt>

export function v_nullable<T extends Validator<any, any, any>>(validator: T) {
    return v.union(v.null(), validator)
}

const repos = defineTable({
    owner: v.string(),
    repo: v.string(),
    private: v.boolean(),

    openIssues: v.number(),
    closedIssues: v.number(),
    openPullRequests: v.number(),
    closedPullRequests: v.number(),
}).index('by_owner_and_repo', ['owner', 'repo'])

const userRepos = defineTable({
    userId: v.id('users'),
    repoId: v.id('repos'),
})
    .index('by_repoId', ['repoId'])
    .index('by_userId_repoId', ['userId', 'repoId'])

const userWorkflows = defineTable({
    userId: v.id('users'),
    syncNotifications: v.object({
        workflowId: vWorkflowId,
        nextSyncAt: v.optional(v_nextSyncAt),
    }),
}).index('by_userId', ['userId'])

const repoWorkflows = defineTable({
    repoId: v.id('repos'),
    issues: v.object({
        workflowId: vWorkflowId,
        nextSyncAt: v.optional(v_nextSyncAt),
        etag: v.optional(v_etag),
    }),
}).index('by_repoId', ['repoId'])

const githubUsers = defineTable({
    githubId: v.number(),
    login: v.string(),
    avatarUrl: v.string(),
}).index('by_githubId', ['githubId'])

const issues = defineTable({
    repoId: v.id('repos'),
    githubId: v.number(),
    number: v.number(), // Issue number in the repo
    title: v.string(),
    state: v.union(v.literal('open'), v.literal('closed')),

    author: possibleGithubUser,
    createdAt: v.string(),
    updatedAt: v.string(),
    closedAt: v.optional(v.string()),
    comments: v.optional(v.number()),
})
    .searchIndex('search_issues', {
        searchField: 'title',
        filterFields: ['repoId', 'state'],
    })
    .index('by_repo_and_number', ['repoId', 'number'])
    .index('by_github_id', ['githubId'])
    .index('by_repo_state_number', ['repoId', 'state', 'number'])
    .index('by_repo_createdAt', ['repoId', 'createdAt'])
    .index('by_repo_updatedAt', ['repoId', 'updatedAt'])
    .index('by_repo_comments', ['repoId', 'comments'])
    .index('by_repo_state_createdAt', ['repoId', 'state', 'createdAt'])
    .index('by_repo_state_updatedAt', ['repoId', 'state', 'updatedAt'])
    .index('by_repo_state_comments', ['repoId', 'state', 'comments'])

const issueLabels = defineTable({
    issueId: v.id('issues'),
    labelId: v.id('labels'),
})
    .index('by_issue_id', ['issueId'])
    .index('by_label_id', ['labelId'])

const labels = defineTable({
    repoId: v.id('repos'),
    githubId: v.string(), // GitHub's unique label ID (base64 string)
    name: v.string(),
    color: v.string(),
})
    .index('by_githubId', ['githubId'])
    .index('by_repoId', ['repoId'])

const issueAssignees = defineTable({
    issueId: v.id('issues'),
    assigneeId: v.id('githubUsers'),
})
    .index('by_issue_id', ['issueId'])
    .index('by_assignee_id', ['assigneeId'])

const issueBodies = defineTable({
    repoId: v.id('repos'),
    issueId: v.id('issues'),
    body: v.string(),
})
    .index('by_issue_id', ['issueId'])
    .searchIndex('search_issue_bodies', {
        searchField: 'body',
        filterFields: ['repoId'],
    })

const issueComments = defineTable({
    issueId: v.id('issues'),
    repoId: v.id('repos'),
    githubId: v.number(),
    author: possibleGithubUser,
    body: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    reactions: v.optional(
        v.array(
            v.object({
                user: possibleGithubUser,
                content: v.string(),
            }),
        ),
    ),
    isDeleted: v.optional(v.boolean()),
})
    .index('by_issue', ['issueId'])
    .searchIndex('search_issue_comments', {
        searchField: 'body',
        filterFields: ['repoId'],
    })

const issueTimelineItems = defineTable({
    issueId: v.id('issues'),
    repoId: v.id('repos'),
    actor: possibleGithubUser,
    createdAt: v.string(),

    item: v.union(
        v.object({ type: v.literal('assigned'), assignee: possibleGithubUser }),
        v.object({ type: v.literal('unassigned'), assignee: possibleGithubUser }),
        v.object({ type: v.literal('labeled'), label: v.id('labels') }),
        v.object({ type: v.literal('unlabeled'), label: v.id('labels') }),
        v.object({ type: v.literal('milestoned'), milestoneTitle: v.string() }),
        v.object({ type: v.literal('demilestoned'), milestoneTitle: v.string() }),
        v.object({ type: v.literal('locked') }),
        v.object({ type: v.literal('unlocked') }),
        v.object({ type: v.literal('pinned') }),
        v.object({ type: v.literal('unpinned') }),
        v.object({ type: v.literal('closed') }),
        v.object({ type: v.literal('reopened') }),
        v.object({
            type: v.literal('renamed'),
            previousTitle: v.string(),
            currentTitle: v.string(),
        }),
        v.object({
            type: v.literal('referenced'),
            commit: v.optional(v.object({ oid: v.string(), url: v.string() })),
        }),
        v.object({
            type: v.literal('cross_referenced'),
            source: v.object({
                type: v.union(v.literal('Issue'), v.literal('PullRequest')),
                owner: v.string(),
                name: v.string(),
                number: v.number(),
            }),
        }),
        v.object({
            type: v.literal('transferred'),
            fromRepository: v.object({ owner: v.string(), name: v.string() }),
        }),
    ),
})
    .index('by_issueId', ['issueId'])
    .index('by_repoId', ['repoId'])
    .index('by_issueId_and_createdAt', ['issueId', 'createdAt'])

export const v_tokenScopes = v.array(
    v.union(
        v.literal('public_repo'),
        v.literal('repo'),
        v.literal('notifications'),
        v.literal('read:org'),
    ),
)

const pats = defineTable({
    githubUser: v.id('githubUsers'),
    userId: v.id('users'),
    token: v.string(),
    scopes: v_tokenScopes,
    expiresAt: v.string(),

    rateLimit: v.optional(
        v.object({
            limit: v.optional(v.string()),
            remaining: v.optional(v.string()),
            reset: v.optional(v.string()),
        }),
    ),
}).index('by_user_id', ['userId'])

// more info at https://docs.github.com/en/rest/activity/notifications?apiVersion=2022-11-28#about-notification-reasons
const notificationReasons = v.union(
    v.literal('approval_requested'),
    v.literal('assign'),
    v.literal('author'),
    v.literal('ci_activity'),
    v.literal('comment'),
    v.literal('invitation'),
    v.literal('manual'),
    v.literal('member_feature_requested'),
    v.literal('mention'),
    v.literal('review_requested'),
    v.literal('security_advisory_credit'),
    v.literal('security_alert'),
    v.literal('state_change'),
    v.literal('subscribed'),
    v.literal('team_mention'),
)

const notifications = defineTable({
    userId: v.id('users'),
    repoId: v.id('repos'),
    type: v.union(v.literal('Issue'), v.literal('PullRequest')),
    // github id corresponds to the notification.id field
    githubId: v.string(),
    // for either issue or pr, this is the number field
    resourceNumber: v.number(),
    reason: notificationReasons,
    updatedAt: v.string(),
    lastReadAt: v.optional(v.string()),
    unread: v.boolean(),
    title: v.string(),
})
    .index('by_github_id', ['githubId'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt'])

export default defineSchema({
    ...authTables,

    // names aren't shortened so that 'go to definition' is direct. Take this object kind of like an index.

    repos: repos,
    userRepos: userRepos,

    githubUsers: githubUsers,

    issues: issues,
    issueLabels: issueLabels,
    issueAssignees: issueAssignees,
    issueBodies: issueBodies,
    issueComments: issueComments,
    issueTimelineItems: issueTimelineItems,

    labels: labels,

    pats: pats,

    notifications: notifications,

    userWorkflows: userWorkflows,
    repoWorkflows: repoWorkflows,
})
