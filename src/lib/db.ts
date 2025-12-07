import 'dotenv/config'

// the generated code uses prisma client internally, but knip reports unused errors. This silences it.
import '@prisma/client'

import { PrismaPg } from '@prisma/adapter-pg'
import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client'
import { appEnv } from './app-env'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
    pool: Pool | undefined
}

// written this way so that hmr doesn't create superfluous connections

let pool: Pool
if (globalForPrisma.pool) {
    pool = globalForPrisma.pool
} else {
    pool = new Pool({ connectionString: appEnv.DATABASE_URL })
    attachDatabasePool(pool)
}

let prisma: PrismaClient
if (globalForPrisma.prisma) {
    prisma = globalForPrisma.prisma
} else {
    prisma = new PrismaClient({
        adapter: new PrismaPg(pool),
    })
}

if (!import.meta.env.PROD) {
    globalForPrisma.prisma = prisma
    globalForPrisma.pool = pool
}

export { prisma }
