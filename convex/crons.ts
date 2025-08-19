import { cronJobs } from 'convex/server'
import { api } from './_generated/api'
import { SECRET } from './utils'

const crons = cronJobs()

crons.interval('run repository sync', { minutes: 5 }, api.services.sync.run, SECRET)

export default crons
