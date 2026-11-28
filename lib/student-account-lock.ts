import type { Prisma } from '@/generated/prisma/client';

export async function lockStudentAccount(tx: Prisma.TransactionClient, userId: string) {
  const [account] = await tx.$queryRaw<{ id: string; banned: boolean; updatedAt: Date }[]>`
    SELECT "id", "banned", "updatedAt" FROM "user"
    WHERE "id" = ${userId} AND "role" = 'student'
    FOR UPDATE
  `;
  return account;
}
