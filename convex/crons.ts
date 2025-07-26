import { cronJobs } from 'convex/server'
import { api } from './_generated/api'

const crons = cronJobs()

crons.interval('sync public repositories', { minutes: 5 }, api.actions.downloadRefs, {
    owner: 'facebook',
    repo: 'react',
})

export default crons
