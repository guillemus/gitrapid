import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { appEnv } from './app-env'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter: new PrismaPg({ connectionString: appEnv.DATABASE_URL }),
    })

if (!import.meta.env.PROD) {
    globalForPrisma.prisma = prisma
}
