import type {
    InstallationDeletedEvent,
    InstallationEvent,
    IssuesAssignedEvent,
    IssuesClosedEvent,
    IssuesEditedEvent,
    IssuesLabeledEvent,
    IssuesOpenedEvent,
    IssuesReopenedEvent,
    IssuesUnassignedEvent,
    IssuesUnlabeledEvent,
    WebhookEvent,
} from '@octokit/webhooks-types'
import type { GenericActionCtx } from 'convex/server'
import { api } from './_generated/api'
import { SECRET, logger } from './utils'

type IssueWebhookEvent =
    | IssuesOpenedEvent
    | IssuesClosedEvent
    | IssuesEditedEvent
    | IssuesReopenedEvent
    | IssuesAssignedEvent
    | IssuesUnassignedEvent
    | IssuesLabeledEvent
    | IssuesUnlabeledEvent

function isIssueWebhookEvent(event: WebhookEvent): event is IssueWebhookEvent {
    return (
        'issue' in event &&
        'repository' in event &&
        'action' in event &&
        typeof event.action === 'string' &&
        [
            'opened',
            'closed',
            'edited',
            'reopened',
            'assigned',
            'unassigned',
            'labeled',
            'unlabeled',
        ].includes(event.action)
    )
}

type Ctx = GenericActionCtx<any>

// handleEvent has to be async and finish as soon as possible, so we will use
// the scheduler to run the mutation without waiting for it to finish.
export async function handleEvent(ctx: Ctx, eventType: string, body: string) {
    const payload = JSON.parse(body) as WebhookEvent

    logger.debug({ eventType }, 'github webhook eventType')
    logger.debug({ payload }, 'github webhook payload')

    if (eventType === 'installation') {
        const installation = payload as InstallationEvent
        await handleInstallation(ctx, installation)
    } else if (eventType === 'installation_removed') {
        const installation = payload as InstallationDeletedEvent
        await handleInstallationRemoved(ctx, installation)
    } else if (eventType === 'issues' && isIssueWebhookEvent(payload)) {
        await handleIssues(ctx, payload)
    } else {
        logger.info({ eventType }, 'Unhandled event')

        // @ts-ignore
        logger.info({ action: payload?.action, type: payload?.type }, 'Type / action')
    }
}

async function handleInstallation(ctx: Ctx, installation: InstallationEvent) {
    const githubInstallationId = installation.installation.id
    const sender = installation.sender
    const userId = sender.id
    const repos = installation.repositories || []

    let installationRepos = []
    for (let repo of repos) {
        let owner = repo.full_name.split('/')[0]
        if (!owner) {
            logger.warn({ full_name: repo.full_name }, 'No owner found for repo')
            continue
        }

        installationRepos.push({
            owner,
            repo: repo.name,
            private: repo.private,
        })
    }

    if (installation.action === 'created') {
        for (let repo of installationRepos) {
            await ctx.scheduler.runAfter(0, api.actions.installRepo, {
                ...SECRET,
                githubInstallationId,
                githubUserId: userId,
                repo: repo.repo,
                owner: repo.owner,
                private: repo.private,
            })
        }
    } else if (installation.action === 'deleted') {
        await ctx.scheduler.runAfter(0, api.models.installations.deleteByGithubInstallationId, {
            ...SECRET,
            githubInstallationId,
        })
    } else if (installation.action === 'suspend') {
        await ctx.scheduler.runAfter(
            0,
            api.models.installations.setSuspendedByGithubInstallationId,
            {
                ...SECRET,
                githubInstallationId,
                suspended: true,
            },
        )
    } else if (installation.action === 'unsuspend') {
        await ctx.scheduler.runAfter(
            0,
            api.models.installations.setSuspendedByGithubInstallationId,
            {
                ...SECRET,
                githubInstallationId,
                suspended: false,
            },
        )
    } else if (installation.action === 'new_permissions_accepted') {
        // we don't care here, just adding it for completeness
        // I mean, we might want to do something in the future, but for now we don't
    } else installation satisfies never
}

async function handleInstallationRemoved(ctx: Ctx, installation: InstallationDeletedEvent) {
    const githubInstallationId = installation.installation.id
    const sender = installation.sender
    const userLogin = sender.login
    const userId = sender.id
    const repos = installation.repositories || []

    // Log the data to be removed from installations table
    const installationsToRemove = repos.map((repo) => ({
        githubRepoId: repo.id,
        githubUserId: userId,
        githubInstallationId,
    }))

    logger.info({ installationsToRemove }, 'Installation removed event')
}

async function handleIssues(ctx: Ctx, payload: IssueWebhookEvent) {
    const { issue, repository, action } = payload

    let repo = await ctx.runQuery(api.models.repos.getByOwnerRepo, {
        ...SECRET,
        owner: repository.owner.login,
        repo: repository.name,
    })
    if (!repo) {
        logger.warn({ owner: repository.owner.login, repo: repository.name }, 'Repo not found')
        return
    }

    let labels: string[] = []
    for (let label of issue.labels ?? []) {
        if (typeof label === 'string') {
            labels.push(label)
        } else if (label.name) {
            labels.push(label.name)
        }
    }

    await ctx.scheduler.runAfter(0, api.models.issues.upsert, {
        ...SECRET,
        repoId: repo._id,
        githubId: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state || 'open',
        body: issue.body ?? undefined,
        author: {
            login: issue.user.login,
            id: issue.user.id,
        },
        labels,
        assignees: issue.assignees?.map((assignee) => assignee.login) ?? undefined,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at ?? undefined,
        comments: issue.comments ?? undefined,
    })

    logger.info(`Issue ${action}: ${repository.owner.login}/${repository.name}#${issue.number}`)
}
