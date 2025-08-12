import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'
import * as schemas from '../schema'

export const getByGithubId = protectedQuery({
    args: { githubId: v.number() },
    handler: (ctx, { githubId }) => models.IssueComments.getByGithubId(ctx, githubId),
})

export const getOrCreate = protectedMutation({
    args: schemas.issueCommentsSchema,
    handler: (ctx, args) => models.IssueComments.getOrCreate(ctx, args),
})

export const upsert = protectedMutation({
    args: schemas.issueCommentsSchema,
    handler: (ctx, args) => models.IssueComments.upsert(ctx, args),
})

export const deleteByIssueId = protectedMutation({
    args: { issueId: v.id('issues') },
    handler: (ctx, { issueId }) => models.IssueComments.deleteByIssueId(ctx, issueId),
})
