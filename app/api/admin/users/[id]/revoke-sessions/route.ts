import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';

/**
 * POST /api/admin/users/[id]/revoke-sessions
 *
 * Admin-only: revoke all sessions for a user (force re-login).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const result = await db.session.deleteMany({
    where: { userId: id },
  });

  return NextResponse.json({
    revoked: result.count,
    message: `Revoked ${result.count} session(s)`,
  });
}

