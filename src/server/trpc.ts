import { auth } from '@/auth'
import { getRequest } from '@tanstack/react-start/server'
import { initTRPC } from '@trpc/server'
import { ZodError } from 'zod'

const t = initTRPC.create({
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError:
                    error.cause instanceof ZodError
                        ? error.cause.flatten((issue) => issue.message)
                        : null,
            },
        }
    },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(async (opts) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
        throw new Error('UNAUTHORIZED')
    }

    return opts.next({
        ctx: {
            session,
        },
    })
})

export type Router = ReturnType<typeof createTRPCRouter>
