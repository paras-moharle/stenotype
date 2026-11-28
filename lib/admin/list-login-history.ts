import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { parsePageNumber } from '@/lib/pagination';

export async function listLoginHistory(params: URLSearchParams, defaultLimit = 50) {
  // parseInt('abc') is NaN, and Prisma rejects NaN skip/take with a 500.
  const requestedLimit = Number.parseInt(
    params.get('limit') ?? String(defaultLimit),
    10
  );
  const page = parsePageNumber(params.get('page') ?? undefined);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : defaultLimit;
  const emailFilter = params.get('email')?.trim().slice(0, 200);
  const successFilter = params.get('success');

  const student = params.get('student');
  const where: Prisma.LoginAttemptWhereInput = student ? { userId: student.slice(0, 128) } : {};
  if (emailFilter) {
    where.email = { contains: emailFilter, mode: 'insensitive' };
  }
  if (successFilter === 'true' || successFilter === 'false') {
    where.success = successFilter === 'true';
  }

  const [attempts, total] = await Promise.all([
    db.loginAttempt.findMany({
      where,
      include: {
        user: {
          select: { name: true, role: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.loginAttempt.count({ where }),
  ]);

  return {
    attempts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

