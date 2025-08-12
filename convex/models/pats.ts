import { v } from 'convex/values'
import { protectedMutation, protectedQuery } from '../utils'
import * as models from './models'

export const getByUserId = protectedQuery({
    args: { userId: v.id('users') },
    handler: (ctx, { userId }) => models.PAT.getByUserId(ctx, userId),
})

export const getOrCreate = protectedMutation({
    args: { userId: v.id('users'), token: v.string() },
    handler: (ctx, args) => models.PAT.getOrCreate(ctx, args),
})
