import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * POST /api/admin/users/[id]/ban
 *
 * Admin-only: ban or unban a user.
 * Body: { banned: boolean, reason?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { banned, reason } = body ?? {};

  if (typeof banned !== 'boolean') {
    return NextResponse.json(
      { error: 'banned must be a boolean' },
      { status: 400 }
    );
  }

  // Prevent self-ban.
  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'You cannot ban yourself' },
      { status: 400 }
    );
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      banned,
      banReason: banned ? (reason ?? null) : null,
      banExpires: null,
    },
    select: { id: true, email: true, banned: true, banReason: true },
  });

  // If banning, revoke all sessions immediately.
  if (banned) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  return NextResponse.json({ user: updated });
}

