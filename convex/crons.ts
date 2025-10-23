import { cronJobs } from 'convex/server'

const crons = cronJobs()

// crons.interval('sync repo issues', { minutes: 5 }, internal.services.sync.cronRepoIssues, {
//     paginationOpts: { numItems: 10, cursor: null },
// })

// crons.interval(
//     'sync user notifications',
//     { minutes: 1 },
//     internal.services.sync.cronUserNotifications,
//     { paginationOpts: { numItems: 10, cursor: null } },
// )

export default crons
