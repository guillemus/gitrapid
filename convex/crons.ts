import { cronJobs } from 'convex/server'
import { api } from './_generated/api'

const crons = cronJobs()

crons.interval('sync public repositories', { minutes: 5 }, api.actions.downloadRefs, {
    owner: 'facebook',
    repo: 'react',
})

crons.interval('check github ratelimit', { minutes: 1 }, api.actions.checkRateLimit)

export default crons
