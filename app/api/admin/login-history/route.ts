import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';

/**
 * GET /api/admin/login-history
 *
 * Admin-only: paginated login attempt history.
 * Query params: ?page=1&limit=50&email=...&success=true|false
 */
export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  // parseInt('abc') is NaN, and Prisma rejects NaN skip/take with a 500.
  const requestedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const requestedLimit = Number.parseInt(
    url.searchParams.get('limit') ?? '50',
    10
  );
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : 50;
  const emailFilter = url.searchParams.get('email');
  const successFilter = url.searchParams.get('success');

  const where: Record<string, unknown> = {};
  if (emailFilter) {
    where.email = { contains: emailFilter, mode: 'insensitive' };
  }
  if (successFilter !== null) {
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
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.loginAttempt.count({ where }),
  ]);

  return NextResponse.json({
    attempts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

