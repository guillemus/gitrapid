import { Polar } from '@polar-sh/sdk'
import { appEnv } from './lib/app-env'

export const polar = new Polar({ accessToken: appEnv.POLAR_TOKEN, server: 'sandbox' })

// @llm-script
