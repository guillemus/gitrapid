import type {
    DefaultArgsForOptionalValidator,
    FunctionArgs,
    FunctionReference,
} from 'convex/server'
import type { PropertyValidators } from 'convex/values'
import pino from 'pino'
import { z } from 'zod'
import { appEnv } from './env'
import { err, ok, type Result } from './shared'

export const logger = createLogger()

function createLogger() {
    if (appEnv.DEBUG_LOGGER) {
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

    return pino({ level: 'info' })
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

export type FnArgs<T extends { args: PropertyValidators }> = DefaultArgsForOptionalValidator<
    T['args']
>[0]

export type WCtx<FuncRef extends FunctionReference<any, any>> = FunctionArgs<FuncRef>['context']
