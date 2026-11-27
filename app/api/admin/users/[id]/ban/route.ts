import { readJson } from '@/lib/mutation-request';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { banUserSchema } from '@/lib/admin/schemas';
import { isNotFoundError } from '@/lib/prisma-errors';

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
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson(request, 16_384);
  if (!body.ok) return body.response;
  const parsed = banUserSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { banned, reason } = parsed.data;

  if (id === gate.userId) {
    return NextResponse.json(
      { error: 'You cannot ban yourself' },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Banning an admin could lock the last administrator out of the site.
  if (banned && target.role === 'admin') {
    return NextResponse.json(
      { error: 'Admin accounts cannot be banned from this screen.' },
      { status: 409 }
    );
  }

  try {
    // Ban and session revocation must succeed together: a banned user
    // with a live session still passes every page check that reads
    // only the session.
    const updated = await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          banned,
          banReason: banned ? (reason ?? null) : null,
          banExpires: null,
        },
        select: { id: true, email: true, banned: true, banReason: true },
      });

      if (banned) {
        await tx.session.deleteMany({ where: { userId: id } });
      }

      return user;
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    throw error;
  }
}
