import { cronJobs } from 'convex/server'

const crons = cronJobs()

// crons.interval('incremental repo sync', { minutes: 5 }, internal.services.sync.checkRepos, {
//     paginationOpts: { numItems: 10, cursor: null },
// })

export default crons
