import { initTRPC } from '@trpc/server'
import { ZodError } from 'zod'

export type TRPCContext = {
    req: Request
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
