import type { Doc, Id } from '@convex/_generated/dataModel'
import { internalMutation, type MutationCtx, type QueryCtx } from '@convex/_generated/server'
import { logger } from '@convex/utils'
import { v } from 'convex/values'
import type { Logger } from 'pino'
import schema, { type PossibleGithubUser } from '../schema'
import type { UpsertDoc } from './models'

export type GithubUserDoc = null | 'github-actions' | Doc<'githubUsers'>

export type TimelineItemWithRelations = {
    _id: Id<'issueTimelineItems'>
    _creationTime: number
    repoId: Id<'repos'>
    createdAt: string
    issueId: Id<'issues'>
    actor: GithubUserDoc

    item:
        | { type: 'assigned'; assignee: GithubUserDoc }
        | { type: 'unassigned'; assignee: GithubUserDoc }
        | { type: 'labeled'; label: Doc<'labels'> }
        | { type: 'unlabeled'; label: Doc<'labels'> }
        | { type: 'milestoned'; milestoneTitle: string }
        | { type: 'demilestoned'; milestoneTitle: string }
        | { type: 'locked' }
        | { type: 'unlocked' }
        | { type: 'pinned' }
        | { type: 'unpinned' }
        | { type: 'closed' }
        | { type: 'reopened' }
        | { type: 'renamed'; previousTitle: string; currentTitle: string }
        | { type: 'referenced'; commit?: { oid: string; url: string } }
        | {
              type: 'cross_referenced'
              source: { type: 'Issue' | 'PullRequest'; owner: string; name: string; number: number }
          }
        | { type: 'transferred'; fromRepository: { owner: string; name: string } }
}

export async function fetchGithubUser(
    ctx: QueryCtx,
    l: Logger,
    user: PossibleGithubUser,
): Promise<GithubUserDoc> {
    if (user === 'github-actions') {
        return 'github-actions'
    } else if (user) {
        let userDoc = await ctx.db.get(user)
        if (userDoc) {
            return userDoc
        } else {
            l.warn(`user ${user} not found`)
        }
    }

    return null
}

export const IssueTimelineItems = {
    async listByIssueId(ctx: QueryCtx, issueId: Id<'issues'>) {
        let items = await ctx.db
            .query('issueTimelineItems')
            .withIndex('by_issueId', (q) => q.eq('issueId', issueId))
            .collect()

        let l = logger.child({ issueId, fn: IssueTimelineItems.listByIssueId.name })

        let withRelations: TimelineItemWithRelations[] = []
        for (let item of items) {
            let itemActor = await fetchGithubUser(ctx, l, item.actor)

            let base = {
                _id: item._id,
                _creationTime: item._creationTime,
                repoId: item.repoId,
                createdAt: item.createdAt,
                issueId: item.issueId,
                actor: itemActor,
            }

            if (item.item.type === 'labeled') {
                let label = await ctx.db.get(item.item.label)
                if (label) {
                    withRelations.push({
                        ...base,
                        item: { type: 'labeled', label: label },
                    })
                } else {
                    l.warn(`Label ${item.item.label} not found`)
                }
            } else if (item.item.type === 'unlabeled') {
                let label = await ctx.db.get(item.item.label)
                if (label) {
                    withRelations.push({
                        ...base,
                        item: { type: 'labeled', label: label },
                    })
                } else {
                    l.warn(`Label ${item.item.label} not found`)
                }
            } else if (item.item.type === 'assigned') {
                let assignee = await fetchGithubUser(ctx, l, item.item.assignee)
                withRelations.push({
                    ...base,
                    item: { type: 'assigned', assignee: assignee },
                })
            } else if (item.item.type === 'unassigned') {
                let assignee = await fetchGithubUser(ctx, l, item.item.assignee)
                withRelations.push({
                    ...base,
                    item: { type: 'unassigned', assignee: assignee },
                })
            } else {
                withRelations.push({ ...base, item: item.item })
            }
        }

        return withRelations
    },

    async insertMany(ctx: MutationCtx, docs: UpsertDoc<'issueTimelineItems'>[]) {
        let ids: Id<'issueTimelineItems'>[] = []
        for (let doc of docs) {
            let id = await ctx.db.insert('issueTimelineItems', doc)
            ids.push(id)
        }
        return ids
    },

    async deleteByIssueId(ctx: MutationCtx, issueId: Id<'issues'>) {
        let items = await ctx.db
            .query('issueTimelineItems')
            .withIndex('by_issueId', (q) => q.eq('issueId', issueId))
            .collect()
        let deletedIds: Id<'issueTimelineItems'>[] = []
        for (let item of items) {
            await ctx.db.delete(item._id)
            deletedIds.push(item._id)
        }
        return deletedIds
    },
}

export const insertMany = internalMutation({
    args: {
        issueId: v.id('issues'),
        timelineItems: v.array(v.object(schema.tables.issueTimelineItems.validator.fields)),
    },
    handler: (ctx, args) => IssueTimelineItems.insertMany(ctx, args.timelineItems),
})
