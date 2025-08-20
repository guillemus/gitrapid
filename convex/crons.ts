import { cronJobs } from 'convex/server'

const crons = cronJobs()

// crons.interval('run repository sync', { minutes: 5 }, api.services.sync.run, SECRET)

export default crons
