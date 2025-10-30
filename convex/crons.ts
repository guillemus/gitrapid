import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
    'sync user notifications',
    { minutes: 5 },
    internal.services.sync.notifications_cron,
    { paginationOpts: { numItems: 10, cursor: null } },
)

export default crons
