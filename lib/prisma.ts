/**
 * Prisma client — lazy, safe to import without a database.
 *
 * The CockroachDB client is only created on first *use*, never at
 * module load time. This keeps `next build` working on hosts that
 * don't set DATABASE_URL yet (the preview doesn't need a DB).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

let prismaClient: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (prismaClient) return prismaClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — the database backend isn't connected yet. " +
        "Preview features (typing, dictations, results) still work without it."
    );
  }

  const adapter = new PrismaPg({ connectionString });
  prismaClient = new PrismaClient({ adapter });
  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string) {
    return (getPrisma() as unknown as PrismaClient)[prop as keyof PrismaClient];
  },
});
