import { cronJobs } from 'convex/server'
import { api } from './_generated/api'

const crons = cronJobs()

crons.interval('check github ratelimit', { minutes: 1 }, api.actions.checkRateLimit)

export default crons
