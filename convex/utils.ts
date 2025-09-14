import type { DefaultArgsForOptionalValidator } from 'convex/server'
import type { PropertyValidators } from 'convex/values'
import pino from 'pino'
import { z } from 'zod'
import type { ActionCtx } from './_generated/server'
import { appEnv } from './env'
import { err, ok, type Result } from './shared'

export const logger = appEnv.DEBUG_LOGGER ? debugLogger() : pino({ level: 'info' })

function debugLogger() {
    return pino({
        level: 'debug',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname,time',
            },
        },
    })
}

export function parseDate(date: string): Result<Date> {
    let d = new Date(date)
    if (Number.isNaN(d.getTime())) {
        return err('invalid date')
    }

    return ok(d)
}

export function zodParse<T extends z.ZodTypeAny>(schema: T, value: unknown): Result<z.infer<T>> {
    let result = schema.safeParse(value)
    if (result.success) {
        return ok(result.data)
    }

    return err(z.prettifyError(result.error))
}

type FnArgs<T extends PropertyValidators> = DefaultArgsForOptionalValidator<T>[0]

/**
 * This might initially be unnecessary complexity, but it's actually useful.
 *
 * - If I have an action that makes sense by itself, but I also want to be callable
 *   from another action without the overhead of a .runAction call, this wrapper makes sense.
 *
 * - If I want to an action logic locally this exposes the handler function so that I can freely call it
 */
export function actionFn<Res, Args extends PropertyValidators>(fn: {
    args: Args
    handler: (ctx: ActionCtx, args: FnArgs<Args>) => Promise<Res>
}) {
    return fn
}
