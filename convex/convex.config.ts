import migrations from '@convex-dev/migrations/convex.config'
import workflow from '@convex-dev/workflow/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(workflow)
app.use(migrations)

export default app
