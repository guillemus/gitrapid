import type { auth } from '@/auth'
import { initTRPC } from '@trpc/server'
import { ZodError } from 'zod'

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

export type TRPCContext = {
    req: Request
    session: AuthSession
}

const t = initTRPC.context<TRPCContext>().create({
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
export const tProcedure = t.procedure
