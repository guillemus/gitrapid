import { appEnv } from './env'

export default {
    providers: [
        {
            domain: appEnv.CONVEX_SITE_URL,
            applicationID: 'convex',
        },
    ],
}
