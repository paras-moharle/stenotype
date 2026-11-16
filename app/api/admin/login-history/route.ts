import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/admin/login-history
 *
 * Admin-only: paginated login attempt history.
 * Query params: ?page=1&limit=50&email=...&success=true|false
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
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

