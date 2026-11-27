import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { poolConfig, runtimeDatabaseUrl } from './db-config';

// Prisma 7 requires a driver adapter to connect. @prisma/adapter-pg
// speaks to Neon Postgres over the standard `pg` driver.
//
// Pool sizing is not cosmetic — see lib/db-config.ts. An oversized or
// unbounded pool is what turns a burst of parallel queries into
// Prisma P2028 transaction timeouts.
// A single shared instance avoids exhausting DB connections in dev
// (HMR) and across serverless re-evaluations.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: runtimeDatabaseUrl(), ...poolConfig }),
    // Give interactive transactions more headroom than Prisma's 2s
    // default so a cold Neon connection cannot turn into a P2028.
    transactionOptions: {
      maxWait: 10_000,
      timeout: 15_000,
    },
  });

// Cache in every environment: re-evaluating this module must never
// create a second pool.
globalForPrisma.prisma = db;
