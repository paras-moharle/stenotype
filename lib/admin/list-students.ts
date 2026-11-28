import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { pageSlice, parsePageParams } from '@/lib/pagination';

export async function listAdminStudents(params: URLSearchParams) {
  const page = parsePageParams(params);
  const query = params.get('q')?.trim().slice(0, 200);

  const status = params.get('status');
  const conditions: Prisma.StudentProfileWhereInput[] = [];
  if (query) conditions.push({ user: { OR: [
    { name: { contains: query, mode: 'insensitive' } },
    { email: { contains: query, mode: 'insensitive' } },
  ] } });
  if (status === 'eligible') conditions.push({ status: 'ACTIVE', user: { banned: false } });
  if (status === 'disabled') conditions.push({ OR: [{ status: { not: 'ACTIVE' } }, { user: { banned: true } }] });

  const rows = await db.studentProfile.findMany({
    where: { AND: conditions },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          banned: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } } } },
        },
      },
      _count: {
        select: {
          typingAttempts: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.take + 1,
    skip: page.skip,
  });

  const students = pageSlice(rows, page);
  const logins = students.length ? await db.loginAttempt.groupBy({
    by: ['userId'],
    where: { userId: { in: students.map(student => student.user.id) }, success: true },
    _max: { createdAt: true },
  }) : [];
  const latestLogin = new Map(logins.map(row => [row.userId, row._max.createdAt]));

  return {
    students: students.map(student => ({
      ...student,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
      user: {
        ...student.user,
        createdAt: student.user.createdAt.toISOString(),
        updatedAt: student.user.updatedAt.toISOString(),
      },
      lastLogin: latestLogin.get(student.user.id)?.toISOString() ?? null,
    })),
    page: { limit: page.limit, offset: page.offset, hasMore: page.hasMore(rows) },
  };
}
