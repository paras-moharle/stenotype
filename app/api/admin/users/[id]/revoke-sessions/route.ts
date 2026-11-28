import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';

/**
 * POST /api/admin/users/[id]/revoke-sessions
 *
 * Admin-only: revoke all sessions for a user (force re-login).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  // Match the ban route: an unknown id is a 404, not a silent success.
  // Check first so an existing user with no sessions still returns 200.
  const target = await db.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const result = await db.$transaction(async tx => {
    // Serialize revocation with student result saves and credential changes.
    await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${id} FOR UPDATE`;
    return tx.session.deleteMany({ where: { userId: id } });
  });

  return NextResponse.json({
    revoked: result.count,
    message: `Revoked ${result.count} session(s)`,
  });
}

