import GitHub from '@auth/core/providers/github'
import type { User } from '@auth/core/types'
import { convexAuth } from '@convex-dev/auth/server'
import { type MutationCtx } from './_generated/server'
import { internal } from './_generated/api'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [
        GitHub({
            authorization: {
                params: {
                    scope: 'read:user user:email notifications',
                },
            },
            profile(githubProfile, tokenset): User & { accessToken?: string } {
                let p = {
                    id: githubProfile.id.toString(),
                    name: githubProfile.name ?? githubProfile.login,
                    email: githubProfile.email,
                    image: githubProfile.avatar_url,
                    accessToken: tokenset.access_token,
                }

                console.debug({ githubProfile, tokenset, usedProfile: p }, 'called profile fn')

                return p
            },
        }),
    ],
    callbacks: {
        // @ts-ignore
        async createOrUpdateUser(ctx: MutationCtx, args) {
            console.debug('calling createOrUpdateUser')

            let accessToken = args.profile.accessToken as string

            if (args.existingUserId) {
                let user = await ctx.db.get(args.existingUserId)
                if (user) {
                    await ctx.db.patch(args.existingUserId, { accessToken })

                    console.debug({ userId: args.existingUserId }, 'existing user id')
                    return args.existingUserId
                }
            }

            let user = await ctx.db
                .query('users')
                .withIndex('email', (q) => q.eq('email', args.profile.email))
                .unique()
            if (user) {
                await ctx.db.patch(user._id, { accessToken })

                console.debug({ userId: user._id }, 'user already exists')
                return user._id
            }

            console.debug({ name: args.profile.name }, 'creating user')

            let userId = await ctx.db.insert('users', {
                name: args.profile.name as string,
                image: args.profile.image as string,
                email: args.profile.email,
                emailVerificationTime: Date.now(),
                // this currently doesn't work for some reason
                githubId: args.profile.id as number,
                accessToken: args.profile.accessToken as string,
            })

            await ctx.scheduler.runAfter(0, internal.services.sync.notifications_startSync, {
                userId,
            })

            return userId
        },
    },
})
